import { afterEach, expect, it, rstest } from '@rstest/core'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { FileStat } from '../src/types'
import { findGameFile, gameDetailPath, readGameReference } from '../src/pages/Home/gameDetailRoute'

const mocks = rstest.hoisted(() => ({ resolve: rstest.fn() }))
rstest.mock('@/library/runtime', () => ({ resolveLibraryFile: mocks.resolve }))
import { useGameDetailFile } from '../src/pages/Home/useGameDetailFile'

const file = {
  filename: '/games/游戏 #1.pkg',
  basename: '游戏 #1.pkg',
  type: 'file',
  size: 1,
  etag: '',
  lastmod: '',
  resourceId: 'file/1',
  libraryId: 'library-a',
  libraryConnectionId: 'source-a',
} as FileStat

afterEach(() => {
  rstest.resetAllMocks()
  rstest.unstubAllGlobals()
})

it('keeps a stable library/resource reference in the URL and round-trips legacy filenames', () => {
  const path = gameDetailPath(file)
  expect(readGameReference(path.slice(path.indexOf('?')))).toMatchObject({
    resourceId: 'file/1',
    libraryId: 'library-a',
    libraryConnectionId: 'source-a',
  })
  expect(path).not.toContain('游戏')
  const legacy = gameDetailPath({ ...file, resourceId: undefined })
  expect(readGameReference(legacy.slice(legacy.indexOf('?')))?.filename).toBe(file.filename)
})

it('does not confuse identical resource IDs in different libraries and finds grouped patches', () => {
  const other = { ...file, libraryId: 'library-b' }
  const patch = { ...file, resourceId: 'patch/1', filename: '/games/patch.pkg' }
  expect(findGameFile([other, { ...file, patchs: [patch] }], { resourceId: 'file/1', libraryId: 'library-a' })).toEqual(
    { ...file, patchs: [patch] },
  )
  expect(findGameFile([other, { ...file, patchs: [patch] }], { resourceId: 'patch/1', libraryId: 'library-a' })).toBe(
    patch,
  )
  expect(findGameFile([other], { resourceId: 'file/1', libraryId: 'library-a' })).toBeUndefined()
})

it('restores a refreshed detail URL without history state, then uses the live aggregated file', async () => {
  rstest.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  let resolve!: (value: FileStat | undefined) => void
  mocks.resolve.mockReturnValue(
    new Promise<FileStat | undefined>((done) => {
      resolve = done
    }),
  )
  const element = document.createElement('div')
  const root = createRoot(element)
  let result!: ReturnType<typeof useGameDetailFile>
  function Probe({ files = [] }: { files?: FileStat[] }) {
    result = useGameDetailFile('?id=file%2F1&library=library-a&source=source-a', files)
    return null
  }
  try {
    await act(async () => root.render(createElement(Probe)))
    expect(result.loading).toBe(true)
    expect(result.file).toBeUndefined()
    await act(async () => resolve(file))
    expect(result.loading).toBe(false)
    expect(result.file).toBe(file)
    const live = { ...file, icon0: 'blob:fresh', patchs: [{ ...file, resourceId: 'patch' }] }
    await act(async () => root.render(createElement(Probe, { files: [live] })))
    expect(result.file).toBe(live)
  } finally {
    await act(async () => root.unmount())
  }
})

it('ignores a previous game recovery after navigation and ends loading for a missing resource', async () => {
  rstest.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  let resolveFirst!: (value: FileStat) => void
  mocks.resolve
    .mockReturnValueOnce(
      new Promise<FileStat>((done) => {
        resolveFirst = done
      }),
    )
    .mockResolvedValueOnce(undefined)
  const root = createRoot(document.createElement('div'))
  let result!: ReturnType<typeof useGameDetailFile>
  function Probe({ id }: { id: string }) {
    result = useGameDetailFile(`?id=${id}&library=library-a`, [], file)
    return null
  }
  try {
    await act(async () => root.render(createElement(Probe, { id: 'first' })))
    expect(result.file).toBeUndefined()
    await act(async () => root.render(createElement(Probe, { id: 'missing' })))
    await act(async () => resolveFirst(file))
    expect(result.loading).toBe(false)
    expect(result.file).toBeUndefined()
  } finally {
    await act(async () => root.unmount())
  }
})
