import { afterEach, describe, expect, it, rstest } from '@rstest/core'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { FileStat } from '../src/types'
const mocks = rstest.hoisted(() => ({ cover: rstest.fn() }))
rstest.mock('../src/library/runtime', () => ({ libraryCover: mocks.cover }))
import { GameCover } from '../src/pages/Home/components/GameCover'

afterEach(() => {
  rstest.restoreAllMocks()
  rstest.unstubAllGlobals()
})
describe('persistent cover references', () => {
  it('restores a task cover from its asset reference and releases the transient URL', async () => {
    rstest.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    const create = rstest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:task-cover')
    const revoke = rstest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    mocks.cover.mockResolvedValue({ bytes: new Uint8Array([1]), contentType: 'image/png' })
    const file: FileStat = {
      filename: 'game.pkg',
      basename: 'game.pkg',
      type: 'file',
      size: 1,
      etag: '',
      lastmod: '',
      resourceId: 'file',
      libraryConnectionId: 'library',
      coverAssetId: 'cover',
    }
    const host = document.createElement('div')
    const root = createRoot(host)
    try {
      await act(async () => {
        root.render(createElement(GameCover, { file }))
      })
      expect(mocks.cover).toHaveBeenCalledWith(file)
      expect(create).toHaveBeenCalledTimes(1)
      expect(host.querySelector('img')?.getAttribute('src')).toBe('blob:task-cover')
    } finally {
      await act(async () => root.unmount())
    }
    expect(revoke).toHaveBeenCalledWith('blob:task-cover')
  })
})
