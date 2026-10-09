import { useEffect, useMemo, useState } from 'react'
import { resolveLibraryFile } from '@/library/runtime'
import type { FileStat } from '@/types'
import { findGameFile, matchesGameReference, readGameReference } from './gameDetailRoute'

export function useGameDetailFile(search: string, files: FileStat[], stateFile?: FileStat, libraryLoading = false) {
  const reference = useMemo(() => readGameReference(search), [search])
  const liveFile = reference ? findGameFile(files, reference) : undefined
  // Blob artwork URLs in history state expire on reload; the indexed file wins.
  const initialFile = reference && stateFile && !matchesGameReference(stateFile, reference) ? undefined : stateFile
  const [recovery, setRecovery] = useState<{ search: string; file?: FileStat; done: boolean }>()

  useEffect(() => {
    if (!reference?.resourceId || liveFile) return
    let cancelled = false
    void resolveLibraryFile(reference as FileStat)
      .then((file) => {
        if (!cancelled) setRecovery({ search, file, done: true })
      })
      .catch(() => {
        if (!cancelled) setRecovery({ search, done: true })
      })
    return () => {
      cancelled = true
    }
  }, [reference, search, Boolean(liveFile)])

  const recovered = recovery?.search === search ? recovery : undefined
  const file = liveFile || (recovered?.done ? recovered.file : initialFile)
  const loading =
    !file && Boolean(reference) && (libraryLoading || (Boolean(reference?.resourceId) && !recovered?.done))
  return { file, loading }
}
