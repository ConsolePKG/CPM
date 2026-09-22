import { throwIfAborted } from '@/utils/abort'
import type { Artwork, Resource, TrophySet } from '@njzy/ps4-pkg-info/web'
import type { FileStat } from '@/types'
export type ResourceKind = 'artwork' | 'trophies'
export type PkgResources = { artwork: Artwork; trophies: Resource<TrophySet> }
export const resourceKey = (file: FileStat) =>
  JSON.stringify([file.downloadUrl, file.filename, file.size, file.etag, file.lastmod])
// Small LRU, bounded by both entry count and encoded resource bytes. Never cache failures.
const cache = new Map<string, { value: PkgResources[ResourceKind]; size: number }>()
let cacheSize = 0
export async function loadPkgResource<K extends ResourceKind>(
  file: FileStat,
  kind: K,
  signal: AbortSignal,
  language = 'default',
): Promise<PkgResources[K]> {
  const key = resourceKey(file) + kind + (kind === 'trophies' ? language : '')
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit.value as PkgResources[K]
  }
  if (!file.downloadUrl) throw new Error('缺少 PKG 下载地址，无法读取资源')
  const pkg = await import('@njzy/ps4-pkg-info/web')
  throwIfAborted(signal)
  const value =
    kind === 'artwork'
      ? await pkg.getPs4PkgArtwork(file.downloadUrl, { signal })
      : await pkg.getPs4PkgTrophies(file.downloadUrl, { signal, language })
  throwIfAborted(signal)
  const size = JSON.stringify(value).length * 2
  const budget = 32 * 1024 * 1024
  while (cache.size && (cacheSize + size > budget || cache.size >= 6)) {
    const oldest = cache.keys().next().value!
    cacheSize -= cache.get(oldest)!.size
    cache.delete(oldest)
  }
  const partial = 'status' in value && value.status === 'ready' && Boolean(value.data.warning)
  if (size <= budget && !partial) {
    cache.set(key, { value, size })
    cacheSize += size
  }
  return value as PkgResources[K]
}
