import { Ps4PkgCategory } from '@njzy/ps4-pkg-info/web'
import type { FileStat } from '@/types'
import { formatPkgName } from '@/utils'
export type ContentFilter = 'all' | 'base' | 'patch' | 'addon'
export type LibrarySort = 'name' | 'recent' | 'size'
export const categoryOf = (file: FileStat): ContentFilter => {
  if (file.paramSfo?.CATEGORY === Ps4PkgCategory.AdditionalContent) return 'addon'
  if (
    file.paramSfo?.CATEGORY === Ps4PkgCategory.GameApplicationPatch ||
    file.paramSfo?.CATEGORY === Ps4PkgCategory.ApplicationPatch
  )
    return 'patch'
  return 'base'
}
export function filterLibrary(
  files: FileStat[],
  query: string,
  category: ContentFilter,
  sort: LibrarySort,
  rawTitle: boolean,
) {
  const text = query.trim().toLocaleLowerCase()
  return files
    .filter(
      (file) =>
        (!text ||
          file.basename.toLocaleLowerCase().includes(text) ||
          file.paramSfo?.TITLE?.toLocaleLowerCase().includes(text)) &&
        (category === 'all' || file.type === 'directory' || categoryOf(file) === category),
    )
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      if (sort === 'size') return b.size - a.size
      if (sort === 'recent') return (Date.parse(b.lastmod) || 0) - (Date.parse(a.lastmod) || 0)
      return formatPkgName(a, rawTitle).localeCompare(formatPkgName(b, rawTitle))
    })
}
