import { describe, expect, it } from '@rstest/core'
import { formatPkgCategory, formatSystemVersion } from '../src/pages/Home/pkgMetadata'

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
