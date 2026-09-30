import type { Ps4PkgParamSfo } from '@njzy/ps4-pkg-info/web'
import { useEffect, useRef, useState, type SetStateAction } from 'react'
import type { FileStat } from '@/types'
import { beginLibraryPkgScan, getLibraryPkgInfo } from './pkgInfoReader'

type CachedInfo = { icon0?: string; paramSfo?: Ps4PkgParamSfo }
type Options = { setFileServerFiles: (value: SetStateAction<FileStat[]>) => void }

export const useWebDavPkgInfo = ({ setFileServerFiles }: Options) => {
  const cache = useRef(new Map<string, CachedInfo>())
  const pending = useRef(new Map<string, CachedInfo>())
  const frame = useRef<number | undefined>(undefined)
  const generation = useRef(0)
  const [pkgInfoDataLoading, setPkgInfoDataLoading] = useState(false)

  const flush = () => {
    frame.current = undefined
    if (!pending.current.size) return
    const updates = new Map(pending.current)
    pending.current.clear()
    setFileServerFiles((files) => {
      let changed = false
      const next = files.map((file) => {
        const info = updates.get(file.downloadUrl || '')
        if (!info || (file.icon0 === info.icon0 && file.paramSfo === info.paramSfo)) return file
        changed = true
        return { ...file, ...info }
      })
      return changed ? next : files
    })
  }

  const getWebDavPkgFileInfo = async (files: FileStat[]) => {
    const currentGeneration = ++generation.current
    setPkgInfoDataLoading(files.length > 0)
    if (files.length) beginLibraryPkgScan()
    await Promise.all(
      files.map(async (file) => {
        try {
          const info = await getLibraryPkgInfo(file.downloadUrl!)
          if (!info || generation.current !== currentGeneration) return
          const url = info.icon0Raw ? URL.createObjectURL(new Blob([new Uint8Array(info.icon0Raw)])) : undefined
          const previous = cache.current.get(file.downloadUrl!)
          if (previous?.icon0 && previous.icon0 !== url) URL.revokeObjectURL(previous.icon0)
          const cached = { icon0: url, paramSfo: info.paramSfo }
          cache.current.set(file.downloadUrl!, cached)
          pending.current.set(file.downloadUrl!, cached)
          if (frame.current === undefined) frame.current = requestAnimationFrame(flush)
        } catch {
          // One invalid PKG should not block the rest of the library.
        }
      }),
    )
    if (generation.current === currentGeneration) setPkgInfoDataLoading(false)
  }

  useEffect(
    () => () => {
      generation.current += 1
      if (frame.current !== undefined) cancelAnimationFrame(frame.current)
      cache.current.forEach((info) => {
        if (info.icon0) URL.revokeObjectURL(info.icon0)
      })
      cache.current.clear()
      pending.current.clear()
    },
    [],
  )

  return {
    getWebDavPkgFileInfo,
    getCachedPkgInfo: (url: string) => cache.current.get(url),
    pkgInfoDataLoading,
  }
}
