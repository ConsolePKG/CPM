import { clone } from './types'
import type { Asset, Library, LibraryStore, ResourceFile, Scan, Snapshot } from './types'

export class MemoryStore implements LibraryStore {
  persistence = 'session' as const
  private state: Snapshot = { libraries: [], files: [], scans: [], revision: 0 }
  private assets = new Map<string, Asset>()
  async load() {
    return clone(this.state)
  }
  async library(value: Library) {
    this.state.libraries = [...this.state.libraries.filter((item) => item.id !== value.id), clone(value)]
  }
  async files(values: ResourceFile[], revision: number) {
    const changed = new Set(values.map((value) => value.id))
    this.state.files = [...this.state.files.filter((value) => !changed.has(value.id)), ...clone(values)]
    this.state.revision = revision
  }
  async scan(value: Scan) {
    this.state.scans = [...this.state.scans.filter((item) => item.id !== value.id), clone(value)]
  }
  async asset(id: string, value?: Asset) {
    if (value) this.assets.set(id, { ...value, bytes: Uint8Array.from(value.bytes) })
    const asset = this.assets.get(id)
    return asset ? { ...asset, bytes: Uint8Array.from(asset.bytes) } : undefined
  }
  async pruneAssets(ids: string[]) {
    const retained = new Set(ids)
    for (const id of this.assets.keys()) if (!retained.has(id)) this.assets.delete(id)
  }
}
