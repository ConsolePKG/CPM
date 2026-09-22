import { afterEach, beforeEach, describe, expect, it, rstest } from '@rstest/core'
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { FileStat } from '../src/types'
const mocks = rstest.hoisted(() => ({ image: rstest.fn(), artwork: rstest.fn(), trophies: rstest.fn() }))
rstest.mock('@njzy/ps4-pkg-info/web', () => ({
  getPs4PkgArtworkImage: mocks.image,
  getPs4PkgArtwork: mocks.artwork,
  getPs4PkgTrophies: mocks.trophies,
}))
import { loadPkgResource } from '../src/pages/Home/pkgResources'
import { PkgResourcePanel } from '../src/pages/Home/components/PkgResourcePanel'
const artwork = [{ id: 0x1220, name: 'pic0.png', size: 100 }]
const file = (name: string): FileStat => ({
  filename: name,
  basename: name,
  downloadUrl: `http://nas/${name}`,
  size: 1000,
  lastmod: '2026-01-01',
  etag: 'a',
  type: 'file',
})
let root: Root, host: HTMLDivElement
beforeEach(() => {
  rstest.resetAllMocks()
  rstest.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  rstest.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private callback: (items: { isIntersecting: boolean }[]) => void) {}
      observe() {
        this.callback([{ isIntersecting: true }])
      }
      disconnect() {}
    },
  )
  mocks.artwork.mockResolvedValue(artwork)
  mocks.image.mockResolvedValue({
    status: 'ready',
    data: { url: 'data:image/png;base64,aA==', extension: 'png', preview: true },
  })
  mocks.trophies.mockResolvedValue({ status: 'missing', message: '没有奖杯' })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  rstest.unstubAllGlobals()
})
describe('detail resources on demand', () => {
  it('performs no reads while inactive, loads only the chosen kind, and exports PNG', async () => {
    const data = file('lazy.pkg')
    await act(async () => root.render(createElement(PkgResourcePanel, { file: data, kind: 'artwork', active: false })))
    expect(mocks.artwork).not.toHaveBeenCalled()
    expect(mocks.trophies).not.toHaveBeenCalled()
    await act(async () => root.render(createElement(PkgResourcePanel, { file: data, kind: 'artwork', active: true })))
    expect(mocks.artwork).toHaveBeenCalledTimes(1)
    expect(mocks.trophies).not.toHaveBeenCalled()
    expect(mocks.image).toHaveBeenCalledTimes(1)
    expect(host.querySelector('a')?.getAttribute('download')).toBe('lazy.pkg-1220-pic0.png')
  })
  it('prioritizes PIC1 then PIC0 with their variants, followed by other PIC PNG artwork', async () => {
    mocks.artwork.mockResolvedValue([
      { id: 10, name: 'pic10.png', size: 100 },
      { id: 102, name: 'pic1_02.png', size: 100 },
      { id: 1, name: 'sce_sys/PIC1.PNG', size: 100 },
      { id: 101, name: 'pic1_01.png', size: 100 },
      { id: 100, name: 'pic0_01.png', size: 100 },
      { id: 2, name: 'sce_sys/PIC2.PNG', size: 100 },
      { id: 0, name: 'pic0.png', size: 100 },
      { id: 20, name: 'icon0.png', size: 100 },
      { id: 21, name: 'save_data.png', size: 100 },
      { id: 22, name: 'pic0.dds', size: 100 },
    ])
    await act(async () =>
      root.render(createElement(PkgResourcePanel, { file: file('filtered.pkg'), kind: 'artwork', active: true })),
    )
    expect([...host.querySelectorAll('h3')].map((item) => item.textContent)).toEqual([
      'PIC1.PNG',
      'pic1_01.png',
      'pic1_02.png',
      'pic0.png',
      'pic0_01.png',
      'PIC2.PNG',
      'pic10.png',
    ])
    expect(host.querySelector('select')).toBeNull()
    expect(mocks.image.mock.calls.map((call) => call[1])).toEqual([1, 101, 102, 0, 100, 2, 10])
  })
  it('shows an empty state when the package only contains other images', async () => {
    mocks.artwork.mockResolvedValue([{ id: 1, name: 'icon0.png', size: 100 }])
    await act(async () =>
      root.render(createElement(PkgResourcePanel, { file: file('no-art.pkg'), kind: 'artwork', active: true })),
    )
    expect(host.textContent).toContain('未包含可展示的艺术图')
    expect(mocks.image).not.toHaveBeenCalled()
  })
  it('reuses complete results and invalidates cache when the file changes', async () => {
    const data = file('cache.pkg'),
      signal = new AbortController().signal
    await loadPkgResource(data, 'artwork', signal)
    await loadPkgResource(data, 'artwork', signal)
    expect(mocks.artwork).toHaveBeenCalledTimes(1)
    await loadPkgResource({ ...data, etag: 'b' }, 'artwork', signal)
    expect(mocks.artwork).toHaveBeenCalledTimes(2)
  })
  it('does not cache failures and permits retry', async () => {
    mocks.artwork.mockRejectedValueOnce(new Error('offline'))
    const data = file('retry.pkg'),
      signal = new AbortController().signal
    await expect(loadPkgResource(data, 'artwork', signal)).rejects.toThrow('offline')
    await expect(loadPkgResource(data, 'artwork', signal)).resolves.toEqual(artwork)
    expect(mocks.artwork).toHaveBeenCalledTimes(2)
  })
  it('aborts hidden panels and ignores results from a previous game', async () => {
    let resolveOld: (value: unknown) => void = () => {}
    mocks.artwork.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve
        }),
    )
    await act(async () =>
      root.render(createElement(PkgResourcePanel, { file: file('old.pkg'), kind: 'artwork', active: true })),
    )
    const oldSignal = mocks.artwork.mock.calls[0][1].signal
    await act(async () =>
      root.render(createElement(PkgResourcePanel, { file: file('new.pkg'), kind: 'artwork', active: true })),
    )
    expect(oldSignal.aborted).toBe(true)
    await act(async () => resolveOld([{ id: 1, name: '旧游戏.png', size: 100 }]))
    expect(host.textContent).not.toContain('旧游戏')
    expect(host.textContent).toContain('pic0.png')
    expect(mocks.image).toHaveBeenCalledTimes(1)
  })
})

describe('trophy language UI', () => {
  it('starts in default, switches on request, caches separately and resets for another game', async () => {
    mocks.trophies.mockImplementation(async (_url: string, options: { language: string }) => ({
      status: 'ready',
      data: {
        trophies: [
          { id: 0, name: options.language === '11' ? '中文奖杯' : 'Default trophy', grade: '金', group: '本体' },
        ],
        availableLanguages: [
          { id: 'default', label: '默认语言' },
          { id: '11', label: '简体中文' },
        ],
      },
    }))
    const data = file('language.pkg')
    await act(async () => root.render(createElement(PkgResourcePanel, { file: data, kind: 'trophies', active: true })))
    expect(host.textContent).toContain('Default trophy')
    const select = () => host.querySelector<HTMLElement>('[aria-label="奖杯语言"]')!
    expect(select().textContent).toContain('默认语言')
    const choose = async (label: string) => {
      await act(async () => select().click())
      await act(async () => {
        const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
          (item) => item.textContent === label,
        )!
        option.click()
      })
    }
    await choose('简体中文')
    expect(host.textContent).toContain('中文奖杯')
    expect(mocks.trophies).toHaveBeenCalledTimes(2)
    await choose('默认语言')
    expect(host.textContent).toContain('Default trophy')
    expect(mocks.trophies).toHaveBeenCalledTimes(2)
    await choose('简体中文')
    await act(async () =>
      root.render(
        createElement(PkgResourcePanel, { file: file('different-language.pkg'), kind: 'trophies', active: true }),
      ),
    )
    expect(select().textContent).toContain('默认语言')
    expect(host.textContent).toContain('Default trophy')
  })
})
