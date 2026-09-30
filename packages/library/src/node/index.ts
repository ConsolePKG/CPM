import { LibraryEngine } from '../core'
import { WebDAVSource } from '../webdav'
import { LibraryError } from '../types'
import { FolderSource } from './folder'
import { SQLiteStore } from './store'
import { nodeWorkerParser } from './parser'
import type { PackageParser } from '../types'

export { SQLiteStore, FolderSource }
export { nodeWorkerParser }
export { createLibraryServer } from './server'
export async function createNodeLibrary(databasePath: string, options: { parser?: PackageParser } = {}) {
  const store = new SQLiteStore(databasePath)
  const engine = await new LibraryEngine(
    store,
    options.parser || nodeWorkerParser(),
    (config) => {
      if (config.type === 'folder') return new FolderSource(config)
      if (config.type === 'webdav') return new WebDAVSource(config)
      throw new LibraryError('unsupported_source', 'Node supports folders and WebDAV')
    },
    2,
    true,
  ).initialize()
  return { engine, store }
}
