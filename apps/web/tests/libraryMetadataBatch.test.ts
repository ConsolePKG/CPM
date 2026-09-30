import { expect, it, rstest } from '@rstest/core'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { FileStat } from '../src/types'

const mocks = rstest.hoisted(() => ({ read: rstest.fn() }))
rstest.mock('../src/hooks/pkgInfoReader', () => ({ getLibraryPkgInfo: mocks.read, beginLibraryPkgScan: () => {} }))
import { useWebDavPkgInfo } from '../src/hooks/useWebDavPkgInfo'

const file = (path: string): FileStat => ({
  basename: 'same.pkg',
  filename: path,
  downloadUrl: `http://nas/${path}`,
  size: 100,
  lastmod: '',
  type: 'file',
})

it('keeps PKG requests concurrent and applies all metadata in one frame', async () => {
  rstest.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const frames: FrameRequestCallback[] = []
  rstest.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback)
    return frames.length
  })
  rstest.stubGlobal('cancelAnimationFrame', rstest.fn())
  const created = rstest
    .spyOn(URL, 'createObjectURL')
    .mockReturnValueOnce('blob:first')
    .mockReturnValueOnce('blob:second')
  const revoked = rstest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  mocks.read.mockImplementation(async (url: string) => ({
    icon0Raw: new Uint8Array([1]),
    paramSfo: { TITLE: url },
  }))

  let files = [file('a/same.pkg'), file('b/same.pkg')]
  const commits: FileStat[][] = []
  const setFiles = (update: (current: FileStat[]) => FileStat[]) => {
    files = update(files)
    commits.push(files)
  }
  let hook!: ReturnType<typeof useWebDavPkgInfo>
  function Harness() {
    hook = useWebDavPkgInfo({ setFileServerFiles: setFiles })
    return null
  }
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  try {
    await act(async () => root.render(createElement(Harness)))
    await act(async () => hook.getWebDavPkgFileInfo(files))
    expect(mocks.read).toHaveBeenCalledTimes(2)
    expect(frames).toHaveLength(1)
    expect(commits).toHaveLength(0)
    await act(async () => frames[0](0))
    expect(commits).toHaveLength(1)
    expect(files.map((item) => item.paramSfo?.TITLE)).toEqual(['http://nas/a/same.pkg', 'http://nas/b/same.pkg'])
    expect(files.map((item) => item.icon0)).toEqual(['blob:first', 'blob:second'])
  } finally {
    await act(async () => root.unmount())
    host.remove()
    expect(revoked).toHaveBeenCalledTimes(2)
    created.mockRestore()
    revoked.mockRestore()
    rstest.unstubAllGlobals()
    mocks.read.mockReset()
  }
})
