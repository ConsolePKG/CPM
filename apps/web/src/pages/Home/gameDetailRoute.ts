import type { FileStat } from '@/types'

export type GameReference = {
  resourceId?: string
  libraryId?: string
  libraryConnectionId?: string
  filename?: string
}

export function gameDetailPath(file: FileStat) {
  const query = new URLSearchParams()
  if (file.resourceId) query.set('id', file.resourceId)
  else query.set('file', file.filename)
  if (file.libraryId) query.set('library', file.libraryId)
  if (file.libraryConnectionId) query.set('source', file.libraryConnectionId)
  return `/game?${query}`
}

export function readGameReference(search: string): GameReference | undefined {
  const query = new URLSearchParams(search)
  const resourceId = query.get('id') || undefined
  const filename = resourceId ? undefined : query.get('file') || undefined
  if (!resourceId && !filename) return undefined
  return {
    resourceId,
    filename,
    libraryId: query.get('library') || undefined,
    libraryConnectionId: query.get('source') || undefined,
  }
}

export function matchesGameReference(file: FileStat, reference: GameReference) {
  if (reference.libraryId && file.libraryId !== reference.libraryId) return false
  if (
    !reference.libraryId &&
    reference.libraryConnectionId &&
    file.libraryConnectionId !== reference.libraryConnectionId
  )
    return false
  return reference.resourceId ? file.resourceId === reference.resourceId : file.filename === reference.filename
}

export function findGameFile(files: FileStat[], reference: GameReference) {
  for (const file of files) {
    const match = [file, ...(file.patchs || []), ...(file.addons || [])].find((candidate) =>
      matchesGameReference(candidate, reference),
    )
    if (match) return match
  }
}
