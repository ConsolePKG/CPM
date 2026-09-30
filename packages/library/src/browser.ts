import { LibraryEngine } from './core'
import { packageParser } from './parser'
import { MemoryStore } from './store'
import { WebDAVSource } from './webdav'
import { boundedSignal } from './abort'
import {
  LibraryError,
  type Asset,
  type Library,
  type LibraryStore,
  type ResourceFile,
  type Scan,
  type SourceAdapter,
  type SourceConfig,
  type Snapshot,
  type PackageParser,
} from './types'

export class BrowserFilesSource implements SourceAdapter {
  constructor(
    public config: SourceConfig,
    private files: Map<string, File>,
  ) {}
  async *entries() {
    if (!this.files.size) throw new LibraryError('permission_required', 'Reselect browser files after reopening', 409)
    for (const [path, file] of this.files)
      yield { path, name: file.name, size: file.size, modified: new Date(file.lastModified).toISOString() }
  }
  async stat(path: string) {
    const file = this.files.get(path)
    if (!file) throw new LibraryError('permission_required', 'Reselect browser files after reopening', 409)
    return { path, name: file.name, size: file.size, modified: new Date(file.lastModified).toISOString() }
  }
  async open(path: string) {
    await this.stat(path)
    const file = this.files.get(path)!
    return {
      readRange: async (offset: number, length: number, signal?: AbortSignal) => {
        signal?.throwIfAborted?.()
        const bytes = new Uint8Array(await file.slice(offset, offset + length).arrayBuffer())
        if (bytes.length !== length) throw new LibraryError('short_read', 'Incomplete file range')
        return bytes
      },
    }
  }
}

export class IndexedDBStore implements LibraryStore {
  persistence = 'indexeddb' as const
  constructor(private database: IDBDatabase) {}
  static async open(name = 'consolepkg-library-v1') {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, 1)
      request.onupgradeneeded = () => {
        for (const name of ['libraries', 'files', 'scans', 'assets', 'settings']) request.result.createObjectStore(name)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return new IndexedDBStore(database)
  }
  private transaction<T>(
    names: string[],
    mode: IDBTransactionMode,
    action: (transaction: IDBTransaction, setResult: (value: T) => void) => void,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const transaction = this.database.transaction(names, mode)
      let result: T
      transaction.oncomplete = () => resolve(result)
      transaction.onabort = () => reject(transaction.error)
      transaction.onerror = () => reject(transaction.error)
      action(transaction, (value) => {
        result = value
      })
    })
  }
  async load(): Promise<Snapshot> {
    const read = (name: string) =>
      this.transaction<any[]>([name], 'readonly', (transaction, setResult) => {
        const request = transaction.objectStore(name).getAll()
        request.onsuccess = () => setResult(request.result)
      })
    const [libraries, files, scans, settings] = await Promise.all(['libraries', 'files', 'scans', 'settings'].map(read))
    return { libraries, files, scans, revision: settings[0] || 0 }
  }
  private write(name: string, id: string, value: unknown) {
    return this.transaction<void>([name], 'readwrite', (transaction) => {
      transaction.objectStore(name).put(value, id)
    })
  }
  library(value: Library) {
    return this.write('libraries', value.id, value)
  }
  scan(value: Scan) {
    return this.write('scans', value.id, value)
  }
  files(values: ResourceFile[], revision: number) {
    return this.transaction<void>(['files', 'settings'], 'readwrite', (transaction) => {
      for (const value of values) transaction.objectStore('files').put(value, value.id)
      transaction.objectStore('settings').put(revision, 'revision')
    })
  }
  asset(id: string, value?: Asset) {
    return this.transaction<Asset | undefined>(
      ['assets'],
      value ? 'readwrite' : 'readonly',
      (transaction, setResult) => {
        if (value) {
          transaction.objectStore('assets').put(value, id)
          setResult(value)
        } else {
          const request = transaction.objectStore('assets').get(id)
          request.onsuccess = () => setResult(request.result)
        }
      },
    )
  }
  close() {
    this.database.close()
  }
  async pruneAssets(ids: string[]) {
    const retained = new Set(ids)
    await this.transaction<void>(['assets'], 'readwrite', (transaction) => {
      const store = transaction.objectStore('assets')
      const request = store.openKeyCursor()
      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          if (!retained.has(String(cursor.key))) store.delete(cursor.key)
          cursor.continue()
        }
      }
    })
  }
}

export function workerParser(createWorker: () => Worker): PackageParser {
  const execute = async (reader: any, operation: string, kind?: string, key?: string, signal?: AbortSignal) => {
    let worker: Worker
    try {
      worker = createWorker()
    } catch {
      return operation === 'parse' ? packageParser.parse(reader, signal) : packageParser.asset!(reader, kind!, key)
    }
    const bounded = boundedSignal(signal, 120000)
    return new Promise<any>((resolve, reject) => {
      let settled = false
      const finish = (error?: Error, result?: unknown) => {
        if (settled) return
        settled = true
        bounded.dispose()
        bounded.signal.removeEventListener('abort', onAbort)
        worker.terminate()
        error ? reject(error) : resolve(result)
      }
      const onAbort = () => finish(new Error('Parser worker aborted or timed out'))
      bounded.signal.addEventListener('abort', onAbort, { once: true })
      if (bounded.signal.aborted) {
        onAbort()
        return
      }
      worker.onerror = () => {
        if (settled) return
        worker.terminate()
        const fallback = {
          readRange: (offset: number, length: number) => reader.readRange(offset, length, bounded.signal),
        }
        ;(operation === 'parse'
          ? packageParser.parse(fallback, bounded.signal)
          : packageParser.asset!(fallback, kind!, key)
        ).then(
          (result) => finish(undefined, result),
          (error) => finish(error),
        )
      }
      worker.onmessage = async ({ data }) => {
        if (data.type === 'read') {
          try {
            const bytes = await reader.readRange(data.offset, data.length, bounded.signal)
            if (!settled) worker.postMessage({ type: 'read-result', id: data.id, bytes })
          } catch (error) {
            if (!settled) worker.postMessage({ type: 'read-result', id: data.id, error: (error as Error).message })
          }
        } else {
          finish(data.error ? new LibraryError('parse_failed', data.error) : undefined, data.result)
        }
      }
      worker.postMessage({ type: 'execute', operation, kind, key })
    })
  }
  return {
    version: packageParser.version,
    parse: (reader, signal) => execute(reader, 'parse', undefined, undefined, signal),
    asset: (reader, kind, key) => execute(reader, 'asset', kind, key),
  }
}

export async function createBrowserLibrary(
  options: { files?: Map<string, Map<string, File>>; parser?: PackageParser; store?: LibraryStore } = {},
) {
  let store = options.store
  if (!store) {
    try {
      store = await IndexedDBStore.open()
    } catch {
      store = new MemoryStore()
    }
  }
  const files = options.files || new Map<string, Map<string, File>>()
  const engine = await new LibraryEngine(store, options.parser || packageParser, (config) => {
    if (config.type === 'webdav') return new WebDAVSource(config)
    if (config.type === 'browser-files') {
      if (!files.has(config.id)) files.set(config.id, new Map())
      return new BrowserFilesSource(config, files.get(config.id)!)
    }
    throw new LibraryError('unsupported_source', 'Browser supports authorized files and WebDAV sources')
  }).initialize()
  return { engine, files, sessionOnly: store.persistence === 'session' }
}
