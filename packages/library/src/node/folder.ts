import { open, realpath, readdir, stat } from 'node:fs/promises'
import { resolve, relative, isAbsolute, basename } from 'node:path'
import { LibraryError, type SourceAdapter, type SourceConfig } from '../types'
import { isSystemMetadataPath } from '../paths'

export class FolderSource implements SourceAdapter {
  constructor(public config: SourceConfig) {
    if (!config.root) throw new LibraryError('invalid_source', 'Folder root required')
  }
  private async location(path: string) {
    const root = await realpath(this.config.root!)
    const target = await realpath(resolve(root, path))
    const boundary = relative(root, target)
    if (boundary === '..' || boundary.startsWith('../') || boundary.startsWith('..\\') || isAbsolute(boundary))
      throw new LibraryError('outside_root', 'File outside source root', 403)
    return target
  }
  async *entries(signal?: AbortSignal) {
    const pending = ['.']
    while (pending.length) {
      signal?.throwIfAborted()
      const directory = pending.shift()!
      const entries = await readdir(await this.location(directory), { withFileTypes: true })
      for (const entry of entries) {
        const path = directory === '.' ? entry.name : `${directory}/${entry.name}`
        if (isSystemMetadataPath(path)) continue
        if (entry.isDirectory()) pending.push(path)
        else if (entry.isFile() && /\.(pkg|nsp|xci|cia|3ds)$/i.test(entry.name)) yield await this.stat(path)
      }
    }
  }
  async stat(path: string) {
    const info = await stat(await this.location(path), { bigint: true })
    if (!info.isFile()) throw new LibraryError('not_file', 'Resource is not a file')
    return {
      path,
      name: basename(path),
      size: Number(info.size),
      modified: new Date(Number(info.mtimeMs)).toISOString(),
      version: `${info.ino}:${info.mtimeNs}:${info.ctimeNs}`,
    }
  }
  async open(path: string) {
    const handle = await open(await this.location(path), 'r')
    return {
      readRange: async (offset: number, length: number, signal?: AbortSignal) => {
        signal?.throwIfAborted()
        if (
          !Number.isSafeInteger(offset) ||
          offset < 0 ||
          !Number.isSafeInteger(length) ||
          length < 0 ||
          length > 32 * 1024 * 1024
        )
          throw new LibraryError('invalid_range', 'Invalid byte range')
        const bytes = new Uint8Array(length)
        let received = 0
        while (received < length) {
          const result = await handle.read(bytes, received, length - received, offset + received)
          if (!result.bytesRead) throw new LibraryError('short_read', 'File changed or truncated')
          received += result.bytesRead
        }
        return bytes
      },
      close: () => handle.close(),
    }
  }
}
