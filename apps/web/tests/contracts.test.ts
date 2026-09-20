import { describe, it, expect } from '@rstest/core'
import { validateConsoleAddress, validateServerUrl } from '../src/pages/Hosts/validation'
import { sampleTransfer, taskKey, transferPercent } from '../src/hooks/taskProgress'
import { filterLibrary } from '../src/pages/Home/library'
import { Ps4PkgCategory } from '@njzy/ps4-pkg-info/web'
import type { FileStat } from '../src/types'
const file = (name: string, category = Ps4PkgCategory.GameDigital): FileStat => ({
  filename: `/${name}.pkg`,
  basename: name + '.pkg',
  type: 'file',
  size: 1024,
  lastmod: '2026-01-01',
  etag: '',
  paramSfo: { TITLE: name, CATEGORY: category } as FileStat['paramSfo'],
})
describe('original functional contracts', () => {
  it('requires a valid console host and port and keeps HTTP', () => {
    expect(validateConsoleAddress('https://192.168.1.2:12801/').url).toBe('http://192.168.1.2:12801')
    for (const value of ['', '192.168.1.2', 'foo:99999', 'host:12801/path'])
      expect(validateConsoleAddress(value).error).toBeTruthy()
  })
  it('validates WebDAV URLs without putting credentials in the URL', () => {
    expect(validateServerUrl('https://nas.local:5006/PS4')).toBeUndefined()
    expect(validateServerUrl('file:///tmp')).toBeTruthy()
    expect(validateServerUrl('https://user:password@nas.local')).toBeTruthy()
  })
  it('keeps directories navigable during category filtering and searches metadata', () => {
    const directory = { ...file('Folder'), type: 'directory' as const }
    const result = filterLibrary(
      [file('Game'), file('Update', Ps4PkgCategory.GameApplicationPatch), directory],
      '',
      'patch',
      'name',
      false,
    )
    expect(result.map((item) => item.basename)).toEqual(['Folder.pkg', 'Update.pkg'])
    const named = file('Raw title')
    named.basename = 'random.pkg'
    expect(filterLibrary([named], 'raw', 'all', 'name', false)).toHaveLength(1)
  })
  it('uses byte deltas and elapsed time, never a fictional initial speed', () => {
    expect(sampleTransfer({}, 1000, 1000).downloadSpeed).toBeUndefined()
    expect(sampleTransfer({ sampleTime: 1000, sampleTransferred: 1000 }, 7000, 4000).downloadSpeed).toBe(2000)
    expect(sampleTransfer({ sampleTime: 1000, sampleTransferred: 7000 }, 1000, 4000).downloadSpeed).toBeUndefined()
    expect(
      sampleTransfer({ sampleTime: 1000, sampleTransferred: 1000, speedHistory: Array(20).fill(1) }, 7000, 4000)
        .speedHistory,
    ).toHaveLength(20)
  })
  it('identifies tasks by originating host as well as task ID', () => {
    expect(taskKey({ taskId: 1, ps4HostUrl: 'http://one' })).not.toBe(taskKey({ taskId: 1, ps4HostUrl: 'http://two' }))
  })
})

describe('progress boundaries', () => {
  it('does not announce completion for a rounded 99.5 percent', () => {
    expect(transferPercent(995, 1000)).toBe(99)
    expect(transferPercent(1000, 1000)).toBe(100)
    expect(transferPercent(1001, 1000)).toBe(100)
    expect(transferPercent(100, 0)).toBe(0)
  })
})
