import {
  clone,
  fileVersion,
  newId,
  pageable,
  LibraryError,
  type Asset,
  type GameEntry,
  type Library,
  type LibraryClient,
  type LibraryStore,
  type ListQuery,
  type PackageParser,
  type ResourceFile,
  type Scan,
  type SourceAdapter,
  type SourceConfig,
} from './types'

export type SourceFactory = (config: SourceConfig) => SourceAdapter | Promise<SourceAdapter>
export class LibraryEngine implements LibraryClient {
  private libraries = new Map<string, Library>()
  private files = new Map<string, ResourceFile>()
  private scans = new Map<string, Scan>()
  private fileKeys = new Map<string, string>()
  private sources = new Map<string, SourceAdapter>()
  private revision = 0
  private running = new Map<string, Promise<void>>()
  private commits: Promise<void> = Promise.resolve()
  private closed = false
  private lifetime = new AbortController()
  private scanLocks: Promise<void> = Promise.resolve()
  private parseActive = 0
  private parseWaiting: (() => void)[] = []
  constructor(
    private store: LibraryStore,
    private parser: PackageParser,
    private factory: SourceFactory,
    private concurrency = 2,
    private publishing = false,
  ) {}
  async initialize() {
    const snapshot = await this.store.load()
    this.revision = snapshot.revision
    snapshot.libraries.forEach((library) => this.libraries.set(library.id, library))
    snapshot.files.forEach((file) => {
      this.files.set(file.id, { ...file, state: file.state === 'parsing' ? 'pending' : file.state })
      this.fileKeys.set(`${file.sourceId}:${file.path}`, file.id)
    })
    snapshot.scans.forEach((scan) =>
      this.scans.set(
        scan.id,
        scan.state === 'running'
          ? { ...scan, state: 'failed', errors: [...scan.errors, 'Interrupted; rescan to reconcile'] }
          : scan,
      ),
    )
    for (const library of this.libraries.values())
      for (const source of library.sources) {
        try {
          this.sources.set(source.id, await this.factory(source))
        } catch {}
      }
    return this
  }
  async capabilities() {
    return {
      protocolVersion: 1 as const,
      writable: true,
      persistence: this.store.persistence,
      publishing: this.publishing,
    }
  }
  async listLibraries() {
    return clone([...this.libraries.values()])
  }
  async createLibrary(name: string, sources: SourceConfig[] = []) {
    if (!name?.trim() || name.length > 255) throw new LibraryError('invalid_name', 'Library name is required')
    const library: Library = {
      id: newId('library'),
      name: name.trim(),
      sources: [],
      createdAt: new Date().toISOString(),
    }
    await this.store.library(library)
    this.libraries.set(library.id, library)
    for (const source of sources) await this.addSource(library.id, source)
    return clone(this.libraries.get(library.id)!)
  }
  async addSource(libraryId: string, source: SourceConfig) {
    const library = this.requireLibrary(libraryId)
    const config = { ...source, id: source.id || newId('source') }
    if ([...this.libraries.values()].some((library) => library.sources.some((source) => source.id === config.id)))
      throw new LibraryError('duplicate_source', 'Source ID already exists', 409)
    const adapter = await this.factory(config)
    const next = { ...library, sources: [...library.sources, config] }
    await this.store.library(next)
    this.libraries.set(libraryId, next)
    this.sources.set(config.id, adapter)
    return clone(next)
  }
  async updateSource(libraryId: string, config: SourceConfig) {
    const library = this.requireLibrary(libraryId)
    if (this.running.has(libraryId))
      throw new LibraryError('scan_active', 'Wait for the current scan before changing sources', 409)
    if (!library.sources.some((source) => source.id === config.id))
      throw new LibraryError('source_not_found', 'Source not found', 404)
    const adapter = await this.factory(config)
    const next = { ...library, sources: library.sources.map((source) => (source.id === config.id ? config : source)) }
    await this.store.library(next)
    this.libraries.set(libraryId, next)
    this.sources.set(config.id, adapter)
    for (const file of this.files.values())
      if (file.sourceId === config.id) await this.update({ ...file, state: 'pending', parserVersion: '' })
    return clone(next)
  }
  async removeSource(libraryId: string, sourceId: string) {
    const library = this.requireLibrary(libraryId)
    if (this.running.has(libraryId))
      throw new LibraryError('scan_active', 'Wait for the current scan before changing sources', 409)
    const next = { ...library, sources: library.sources.filter((source) => source.id !== sourceId) }
    await this.store.library(next)
    this.libraries.set(libraryId, next)
    this.sources.delete(sourceId)
    for (const file of this.files.values())
      if (file.sourceId === sourceId) await this.update({ ...file, available: false })
  }
  async listFiles(libraryId: string, query: ListQuery = {}) {
    this.requireLibrary(libraryId)
    const search = query.search?.toLowerCase()
    return pageable(
      clone([...this.files.values()])
        .filter(
          (file) =>
            file.libraryId === libraryId &&
            (!query.sourceId || file.sourceId === query.sourceId) &&
            (!search || `${file.name} ${file.metadata?.title || ''}`.toLowerCase().includes(search)),
        )
        .sort((first, second) => first.path.localeCompare(second.path)),
      query,
      this.revision,
    )
  }
  async getFile(fileId: string) {
    const file = this.files.get(fileId)
    if (!file) throw new LibraryError('file_not_found', 'Resource not found', 404)
    return clone(file)
  }
  async listGames(libraryId: string, query: ListQuery = {}) {
    this.requireLibrary(libraryId)
    const groups = new Map<string, GameEntry>()
    for (const file of this.files.values()) {
      if (file.libraryId !== libraryId || !file.available || (query.sourceId && query.sourceId !== file.sourceId))
        continue
      const metadata = file.metadata
      const key = metadata?.titleId
        ? `${metadata.platform}:${metadata.titleId}:${metadata.compatibilityKey || ''}`
        : file.id
      let entry = groups.get(key)
      if (!entry) {
        entry = {
          id: `${libraryId}:${key}`,
          libraryId,
          title: metadata?.title || file.name,
          titleId: metadata?.titleId,
          platform: metadata?.platform || 'unknown',
          base: [],
          patches: [],
          dlcs: [],
          unknown: [],
        }
        groups.set(key, entry)
      }
      const bucket =
        metadata?.kind === 'base'
          ? entry.base
          : metadata?.kind === 'patch'
            ? entry.patches
            : metadata?.kind === 'dlc'
              ? entry.dlcs
              : entry.unknown
      bucket.push(file.id)
      if (metadata?.kind === 'base' && metadata.title) entry.title = metadata.title
    }
    const search = query.search?.toLowerCase()
    return pageable(
      [...groups.values()].filter((entry) => !search || entry.title.toLowerCase().includes(search)),
      query,
      this.revision,
    )
  }
  async scan(libraryId: string) {
    const previous = this.scanLocks
    let release: () => void
    this.scanLocks = new Promise<void>((resolve) => {
      release = resolve
    })
    await previous
    try {
      return await this.startScan(libraryId)
    } finally {
      release!()
    }
  }
  async getGame(libraryId: string, gameId: string) {
    let cursor: string | undefined
    do {
      const page = await this.listGames(libraryId, { cursor, limit: 200 })
      const game = page.items.find((entry) => entry.id === gameId)
      if (game) return game
      cursor = page.nextCursor
    } while (cursor)
    throw new LibraryError('game_not_found', 'Game entry not found', 404)
  }
  private async startScan(libraryId: string) {
    const library = this.requireLibrary(libraryId)
    if (this.closed) throw new LibraryError('closed', 'Library is closed', 503)
    if (this.running.has(libraryId))
      return clone(
        [...this.scans.values()].reverse().find((scan) => scan.libraryId === libraryId && scan.state === 'running')!,
      )
    const scan: Scan = { id: newId('scan'), libraryId, state: 'running', discovered: 0, parsed: 0, errors: [] }
    await this.store.scan(scan)
    this.scans.set(scan.id, scan)
    const work = Promise.resolve()
      .then(() => this.executeScan(library, scan))
      .finally(() => this.running.delete(libraryId))
    this.running.set(libraryId, work)
    return clone(scan)
  }
  async getScan(scanId: string) {
    const scan = this.scans.get(scanId)
    if (!scan) throw new LibraryError('scan_not_found', 'Scan not found', 404)
    return clone(scan)
  }
  async idle() {
    await Promise.all(this.running.values())
    await this.commits
  }
  async close() {
    this.closed = true
    this.lifetime.abort()
    await this.idle()
    await this.store.pruneAssets?.(
      [...this.files.values()].map((file) => file.coverId).filter((id): id is string => !!id),
    )
    await this.store.close?.()
  }
  async retry(fileId: string) {
    const file = await this.getFile(fileId)
    await this.running.get(file.libraryId)
    await this.update({ ...file, state: 'pending', parserVersion: '', message: undefined })
    await this.scan(file.libraryId)
  }
  async changes(libraryId: string, after: number) {
    this.requireLibrary(libraryId)
    if (!Number.isSafeInteger(after) || after < 0) throw new LibraryError('invalid_revision', 'Invalid revision')
    return {
      revision: this.revision,
      reset: after > this.revision,
      files: clone(
        [...this.files.values()].filter(
          (file) => file.libraryId === libraryId && (after > this.revision || file.revision > after),
        ),
      ),
    }
  }
  async asset(assetId: string): Promise<Asset> {
    const asset = await this.store.asset(assetId)
    if (!asset) throw new LibraryError('asset_not_found', 'Asset not found', 404)
    return asset
  }
  async resource(fileId: string, kind: string, key?: string) {
    const file = await this.getFile(fileId)
    if (!file.available || !file.metadata || !this.parser.asset)
      throw new LibraryError('unsupported_asset', 'Resource cannot be extracted', 409)
    const source = this.sources.get(file.sourceId)!
    const before = await source.stat(file.path)
    if (fileVersion(before) !== file.fileVersion) throw new LibraryError('file_changed', 'Rescan changed resource', 409)
    const reader = await source.open(file.path)
    try {
      const result = await this.parser.asset(reader, kind, key)
      if (fileVersion(await source.stat(file.path)) !== file.fileVersion)
        throw new LibraryError('file_changed', 'Resource changed during extraction', 409)
      return result
    } finally {
      await reader.close?.()
    }
  }
  async download(fileId: string) {
    const file = await this.getFile(fileId)
    if (!file.available) throw new LibraryError('file_unavailable', 'Resource is unavailable', 409)
    const source = this.sources.get(file.sourceId)!
    if (fileVersion(await source.stat(file.path)) !== file.fileVersion)
      throw new LibraryError('file_changed', 'Resource changed; rescan before downloading', 409)
    const url = await source.download?.(file.path)
    return {
      url,
      fileVersion: file.fileVersion,
      unavailable: url
        ? undefined
        : 'Publish this resource through a desktop/NAS library, or provide a console-readable URL',
    }
  }
  async openFile(fileId: string) {
    const file = await this.getFile(fileId)
    const source = this.sources.get(file.sourceId)!
    if (!file.available || fileVersion(await source.stat(file.path)) !== file.fileVersion)
      throw new LibraryError('file_changed', 'Resource unavailable or changed', 409)
    const opened = await source.open(file.path)
    return {
      file,
      reader: {
        readRange: async (offset: number, length: number, signal?: AbortSignal) => {
          if (fileVersion(await source.stat(file.path)) !== file.fileVersion)
            throw new LibraryError('file_changed', 'Resource changed during transfer', 409)
          const bytes = await opened.readRange(offset, length, signal)
          if (fileVersion(await source.stat(file.path)) !== file.fileVersion)
            throw new LibraryError('file_changed', 'Resource changed during transfer', 409)
          return bytes
        },
        close: () => opened.close?.(),
      },
    }
  }
  private requireLibrary(id: string) {
    const library = this.libraries.get(id)
    if (!library) throw new LibraryError('library_not_found', 'Library not found', 404)
    return library
  }
  private update(file: ResourceFile) {
    const commit = this.commits.then(async () => {
      const revision = this.revision + 1
      const next = { ...file, revision }
      await this.store.files([next], revision)
      this.revision = revision
      this.files.set(next.id, next)
      this.fileKeys.set(`${next.sourceId}:${next.path}`, next.id)
    })
    this.commits = commit.catch(() => {})
    return commit
  }
  private async executeScan(library: Library, scan: Scan) {
    const active = new Set<Promise<void>>()
    const dispatch = async (file: ResourceFile) => {
      const task = this.scheduleParse(file, scan).finally(() => active.delete(task))
      active.add(task)
      if (active.size >= Math.max(1, this.concurrency)) await Promise.race(active)
    }
    try {
      for (const config of library.sources) {
        const seen = new Set<string>()
        let complete = false
        try {
          const source = this.sources.get(config.id) || (await this.factory(config))
          this.sources.set(config.id, source)
          for await (const entry of source.entries(this.lifetime.signal)) {
            if (this.closed) break
            seen.add(entry.path)
            const previous = this.files.get(this.fileKeys.get(`${config.id}:${entry.path}`) || '')
            const version = fileVersion(entry)
            const reusable =
              !!(entry.modified || entry.etag || entry.version) &&
              previous?.fileVersion === version &&
              previous.parserVersion === this.parser.version &&
              ['ready', 'partial', 'unsupported'].includes(previous.state)
            const file: ResourceFile = {
              ...previous,
              ...entry,
              metadata: reusable ? previous?.metadata : undefined,
              coverId: reusable ? previous?.coverId : undefined,
              id: previous?.id || newId('file'),
              libraryId: library.id,
              sourceId: config.id,
              available: true,
              fileVersion: version,
              parserVersion: reusable ? this.parser.version : '',
              state: reusable ? previous!.state : 'pending',
              revision: this.revision,
            }
            if (!reusable || !previous?.available) await this.update(file)
            scan.discovered++
            if (!reusable) {
              await dispatch(file)
            }
          }
          complete = !this.closed
        } catch (error) {
          scan.errors.push(`${config.name}: ${(error as Error).message}`)
        }
        if (complete)
          for (const file of [...this.files.values()])
            if (file.sourceId === config.id && file.available && !seen.has(file.path))
              await this.update({ ...file, available: false })
      }
      await Promise.all(active)
      scan.state = scan.errors.length ? 'failed' : 'completed'
    } catch (error) {
      await Promise.allSettled(active)
      scan.state = 'failed'
      scan.errors.push((error as Error).message)
    }
    await this.store.scan(scan)
  }
  private async scheduleParse(file: ResourceFile, scan: Scan) {
    if (this.parseActive >= Math.max(1, this.concurrency))
      await new Promise<void>((resolve) => this.parseWaiting.push(resolve))
    else this.parseActive++
    try {
      if (this.closed) return
      await this.parseFile(file, scan)
    } finally {
      const next = this.parseWaiting.shift()
      if (next) next()
      else this.parseActive--
    }
  }
  private async parseFile(file: ResourceFile, scan: Scan, attempt = 0) {
    const source = this.sources.get(file.sourceId)!
    let reader: Awaited<ReturnType<SourceAdapter['open']>> | undefined
    try {
      await this.update({ ...file, state: 'parsing' })
      reader = await source.open(file.path)
      const result = await this.parser.parse(reader, this.lifetime.signal)
      const version = fileVersion(await source.stat(file.path))
      if (version !== file.fileVersion) {
        const changed = {
          ...file,
          ...(await source.stat(file.path)),
          fileVersion: version,
          state: 'pending' as const,
          parserVersion: '',
          message: 'File changed during parsing',
        }
        await this.update(changed)
        await reader.close?.()
        reader = undefined
        if (attempt < 2) await this.parseFile(changed, scan, attempt + 1)
        return
      }
      const coverId = result.cover ? newId('cover') : undefined
      if (coverId) await this.store.asset(coverId, { bytes: result.cover!, contentType: 'image/png' })
      await this.update({
        ...file,
        state: result.state,
        metadata: result.metadata,
        coverId,
        parserVersion: this.parser.version,
        message: result.message,
      })
    } catch (error) {
      await this.update({
        ...file,
        state: this.closed ? 'pending' : 'failed',
        parserVersion: '',
        message: (error as Error).message,
      })
    } finally {
      await reader?.close?.()
      if (!attempt) scan.parsed++
    }
  }
}
