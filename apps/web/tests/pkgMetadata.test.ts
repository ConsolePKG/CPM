import { describe, expect, it } from '@rstest/core'
import { formatPkgCategory, formatSystemVersion, formatPs5SystemVersion, pkgInfo } from '../src/pages/Home/pkgMetadata'

describe('SFO display formatting', () => {
  it('decodes packed decimal firmware versions, including two-digit major versions', () => {
    expect(formatSystemVersion(0x09000000)).toBe('9.00')
    expect(formatSystemVersion(0x05500000)).toBe('5.50')
    expect(formatSystemVersion(0x11000001)).toBe('11.00')
    expect(formatSystemVersion('0x12520000')).toBe('12.52')
    expect(formatSystemVersion(String(0x09000000))).toBe('9.00')
  })
  it('keeps missing and unfamiliar firmware values distinct', () => {
    expect(formatSystemVersion(undefined)).toBe('—')
    for (const value of [-1, 0x100000000, 0x0a000000, '9.00', 'invalid']) {
      expect(formatSystemVersion(value)).toBe(String(value))
    }
  })
  it('labels common package types and preserves unknown categories', () => {
    expect(formatPkgCategory('gd')).toBe('游戏本体')
    expect(formatPkgCategory('gp')).toBe('游戏补丁')
    expect(formatPkgCategory('ac')).toBe('追加内容（DLC）')
    expect(formatPkgCategory('unknown')).toBe('unknown')
    expect(formatPkgCategory(undefined)).toBe('—')
  })
})

describe('PS5 metadata presentation', () => {
  it('formats 64-bit firmware without floating point rounding and preserves unknown encodings', () => {
    expect(formatPs5SystemVersion('0x0900000000000000')).toBe('9.00')
    expect(formatPs5SystemVersion('0x1252000000000001')).toBe('12.52')
    expect(formatPs5SystemVersion('0x0a00000000000000')).toBe('0x0a00000000000000')
    expect(formatPs5SystemVersion(undefined)).toBe('—')
  })
  it('provides PS5 details without fabricating a PS4 SFO', () => {
    const file = {
      resourcePlatform: 'ps5',
      resourceKind: 'dlc',
      resourceMetadata: {
        platform: 'ps5',
        format: 'ps5-pkg',
        kind: 'dlc',
        title: 'Bonus',
        titleId: 'PPSA21559',
        contentId: 'JP9000-PPSA21559_00-PREORDER00000000',
        version: '01.000.000',
        masterVersion: '01.00',
        requiredSystemVersion: '0x0100000000000000',
        raw: { titleId: 'PPSA21559' },
      },
    } as import('../src/types').FileStat
    expect(pkgInfo(file)).toMatchObject({
      platform: 'PS5',
      title: 'Bonus',
      titleId: 'PPSA21559',
      version: '01.000.000',
      masterVersion: '01.00',
      systemVersion: '1.00',
      isDlc: true,
      category: '追加内容（DLC）',
    })
    expect(file.paramSfo).toBeUndefined()
  })
})
