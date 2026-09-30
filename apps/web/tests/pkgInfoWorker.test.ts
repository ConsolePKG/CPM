import { afterEach, expect, it, rstest } from '@rstest/core'

const mocks = rstest.hoisted(() => ({ read: rstest.fn() }))
rstest.mock('@/utils/browser', () => ({ isPlayStationBrowser: true }))
rstest.mock('@njzy/ps4-pkg-info/web', () => ({ getPs4PkgInfo: mocks.read }))
import { getLibraryPkgInfo } from '../src/hooks/pkgInfoReader'

afterEach(() => rstest.unstubAllGlobals())

it('parses PKG metadata in a Worker and falls back after Worker failure', async () => {
  class FakeWorker {
    onmessage?: (event: MessageEvent<{ id: number; info: unknown }>) => void
    onerror?: () => void
    last?: { id: number; url: string }
    postMessage(value: { id: number; url: string }) {
      this.last = value
    }
    terminate() {}
  }
  let instance: FakeWorker
  rstest.stubGlobal(
    'Worker',
    class extends FakeWorker {
      constructor() {
        super()
        instance = this
      }
    },
  )
  const task = getLibraryPkgInfo('http://nas/a.pkg')
  expect(instance!.last?.url).toBe('http://nas/a.pkg')
  expect(mocks.read).not.toHaveBeenCalled()
  instance!.onmessage?.({ data: { id: instance!.last!.id, info: { paramSfo: { TITLE: 'A' } } } } as MessageEvent)
  expect((await task)?.paramSfo?.TITLE).toBe('A')
  mocks.read.mockResolvedValue({ paramSfo: { TITLE: 'fallback' } })
  const pending = getLibraryPkgInfo('http://nas/b.pkg')
  instance!.onerror?.()
  expect((await pending)?.paramSfo?.TITLE).toBe('fallback')
  expect(mocks.read).toHaveBeenCalledWith('http://nas/b.pkg')
})
