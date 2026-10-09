import { describe, expect, it } from '@rstest/core'
import { Buffer } from 'buffer'
import { sha1 } from '@noble/hashes/legacy.js'
import { readPNG } from 'tex-decoder/build/esm/png_maker.js'
import { packageParser } from '../src/parser'
import { ddsToPng } from '../src/ps5Images'
import { ps5Json } from '../src/ps5'
import type { ByteReader, SourceAdapter } from '../src/types'
import { LibraryEngine } from '../src/core'
import { MemoryStore } from '../src/store'
import { nodeWorkerParser } from '../src/node/parser'
import { packageFixture } from './fixtures'

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=',
  'base64',
)
const param = {
  titleId: 'PPSA21567',
  contentId: 'EP9000-PPSA21567_00-0000000000000000',
  contentVersion: '01.018.000',
  masterVersion: '01.00',
  requiredSystemSoftwareVersion: '0x0900000000000000',
  applicationCategoryType: 0,
  localizedParameters: {
    defaultLanguage: 'en-US',
    'en-US': { titleName: 'ASTRO BOT' },
    'zh-Hans': { titleName: '宇宙机器人' },
  },
}
function fixture(
  options: {
    cntOffset?: number
    type?: number
    flags?: number
    raw?: Record<string, unknown>
    encrypted?: boolean
    extra?: Map<number, Buffer>
  } = {},
) {
  const offset = options.cntOffset ?? 0x8f77b0000
  const cnt = Buffer.alloc(0x6000)
  cnt.writeUInt32BE(0x7f434e54)
  cnt.writeUInt16BE(2, 4)
  cnt.writeUInt32BE(12, 12)
  cnt.write(param.contentId, 0x40)
  cnt.writeUInt32BE(options.type ?? 0x20, 0x74)
  cnt.writeUInt32BE(options.flags ?? 0, 0x78)
  const entries = new Map([
    [0x2000, Buffer.from(JSON.stringify(options.raw ?? param))],
    [0x1200, png],
    ...(options.extra ?? []),
  ])
  cnt.writeUInt32BE(entries.size, 0x10)
  cnt.writeUInt32BE(0x5a0, 0x18)
  let index = 0,
    cursor = 0x1000
  const chunks: [number, Buffer][] = [[offset, cnt]]
  for (const [id, bytes] of entries) {
    const p = 0x5a0 + index++ * 32
    cnt.writeUInt32BE(id, p)
    cnt.writeUInt32BE(options.encrypted && id === 0x2000 ? 0x80000000 : 0x08000000, p + 8)
    cnt.writeUInt32BE(cursor, p + 16)
    cnt.writeUInt32BE(bytes.length, p + 20)
    chunks.push([offset + cursor, bytes])
    cursor += bytes.length
  }
  if (offset) {
    const fih = Buffer.alloc(96)
    fih.writeUInt32BE(0x7f464948)
    fih.writeUInt16LE(3, 6)
    fih.writeBigUInt64LE(BigInt(offset), 0x58)
    chunks.unshift([0, fih])
  }
  const reads: [number, number][] = []
  const reader: ByteReader = {
    size: offset + 0x6000,
    readRange: async (start, length) => {
      reads.push([start, length])
      const result = Buffer.alloc(length)
      let filled = 0
      for (const [position, bytes] of chunks) {
        const from = Math.max(start, position),
          to = Math.min(start + length, position + bytes.length)
        if (from < to) {
          bytes.copy(result, from - start, from - position, to - position)
          filled = Math.max(filled, to - start)
        }
      }
      if (filled !== length) throw new Error('Unmapped range')
      return result
    },
  }
  return { reader, reads, cnt, chunks }
}
function ucp() {
  const config = {
    trophyNpCommId: 'NPWR12345_00',
    trophySetVersion: '1',
    trophyDefinitionRevision: 1,
    defaultLanguage: 'en-US',
    trophies: [
      { id: '0000', grade: 'P', hidden: false },
      { id: '0001', grade: 'B', hidden: true },
    ],
  }
  const metadata = (name: string) => ({
    ...config,
    metadata: {
      titleMetadata: { name },
      trophyMetadata: [
        { id: '0000', name, detail: 'All trophies' },
        { id: '0001', name: 'Secret', detail: 'Finish story' },
      ],
    },
  })
  const files = new Map([
    ['tropconf.json', Buffer.from(JSON.stringify(config))],
    ['tropmeta_en-US.json', Buffer.from(JSON.stringify(metadata('ASTRO BOT')))],
    ['tropmeta_zh-Hans.json', Buffer.from(JSON.stringify(metadata('宇宙机器人')))],
    ['trop0000.png', png],
  ])
  const bytes = Buffer.alloc(96 + files.size * 64 + [...files.values()].reduce((sum, data) => sum + data.length, 0))
  bytes.writeUInt32BE(0xb228c60a)
  bytes.writeUInt32BE(1, 4)
  bytes.writeBigUInt64BE(BigInt(bytes.length), 8)
  bytes.writeUInt32BE(files.size, 16)
  bytes.writeUInt32BE(64, 20)
  let p = 96,
    offset = 96 + files.size * 64
  for (const [name, data] of files) {
    bytes.write(name, p)
    bytes.writeBigUInt64BE(BigInt(offset), p + 32)
    bytes.writeBigUInt64BE(BigInt(data.length), p + 40)
    data.copy(bytes, offset)
    p += 64
    offset += data.length
  }
  Buffer.from(sha1(bytes)).copy(bytes, 0x1c)
  return bytes
}
describe('PS5 packages', () => {
  it('reparses cached unsupported files and keeps orphan DLC from another region separate', async () => {
    const samples = new Map([
      ['base.pkg', fixture()],
      ['copy.pkg', fixture()],
      ['patch.pkg', fixture({ flags: 0x00100000 })],
      ['addon.pkg', fixture({ type: 0x21, raw: { ...param, applicationCategoryType: 1 } })],
      ['orphan.pkg', fixture({ type: 0x21, raw: { ...param, titleId: 'PPSA21559', applicationCategoryType: 1 } })],
    ])
    const config = { id: 'ps5', type: 'folder' as const, name: 'PS5' }
    const entry = (path: string) => ({ path, name: path, size: samples.get(path)!.reader.size!, version: 'unchanged' })
    const source: SourceAdapter = {
      config,
      entries: async function* () {
        for (const path of samples.keys()) yield entry(path)
      },
      stat: async (path) => entry(path),
      open: async (path) => samples.get(path)!.reader,
    }
    const store = new MemoryStore()
    const old = await new LibraryEngine(
      store,
      {
        version: 'consolepkg-1',
        parse: async () => ({
          state: 'unsupported',
          metadata: { platform: 'unknown', format: 'unknown', kind: 'unknown', raw: {} },
        }),
      },
      () => source,
    ).initialize()
    const library = await old.createLibrary('PS5', [config])
    await old.scan(library.id)
    await old.idle()
    await old.close()
    const engine = await new LibraryEngine(store, packageParser, () => source).initialize()
    try {
      await engine.scan(library.id)
      await engine.idle()
      const files = (await engine.listFiles(library.id)).items
      expect(files.every((f) => f.state === 'ready' && f.coverId && f.parserVersion === packageParser.version)).toBe(
        true,
      )
      const games = (await engine.listGames(library.id)).items
      expect(games).toHaveLength(2)
      const base = games.find((g) => g.titleId === 'PPSA21567')!
      expect(base.base).toHaveLength(2)
      expect(base.patches).toHaveLength(1)
      expect(base.dlcs).toHaveLength(1)
      const orphan = games.find((g) => g.titleId === 'PPSA21559')!
      expect(orphan.base).toHaveLength(0)
      expect(orphan.dlcs).toHaveLength(1)
    } finally {
      await engine.close()
    }
  })
  it('reads finalized metadata after 32 GiB without downloading the body or truncating offsets', async () => {
    const { reader, reads } = fixture()
    const result = await packageParser.parse(reader)
    expect(result.state).toBe('ready')
    expect(result.metadata).toMatchObject({
      platform: 'ps5',
      format: 'ps5-pkg',
      kind: 'base',
      title: '宇宙机器人',
      titleId: 'PPSA21567',
      version: '01.018.000',
      requiredSystemVersion: '0x0900000000000000',
    })
    expect(result.cover).toEqual(Uint8Array.from(png))
    expect(reads.some(([offset]) => offset > 0xffffffff)).toBe(true)
    expect(reads.reduce((sum, [, length]) => sum + length, 0)).toBeLessThan(10000)
  })
  it('propagates file size and 64-bit offsets through the node parser worker', async () => {
    const { reader } = fixture()
    expect((await nodeWorkerParser().parse(reader)).metadata.titleId).toBe('PPSA21567')
  })
  it('distinguishes direct PS5 CNT from PS4 CNT', async () => {
    expect((await packageParser.parse(fixture({ cntOffset: 0 }).reader)).metadata.platform).toBe('ps5')
    const bytes = packageFixture()
    expect((await packageParser.parse({ readRange: async (p, n) => bytes.subarray(p, p + n) })).metadata).toMatchObject(
      { platform: 'ps4', kind: 'base', titleId: 'CUSA12345' },
    )
  })
  it('reads LIH patch metadata from its explicit CNT segment', async () => {
    const sample = fixture({ cntOffset: 0x20000 })
    const lih = Buffer.alloc(96)
    lih.writeUInt32BE(0x7f4c4948)
    lih.writeUInt16LE(1, 6)
    lih.writeUInt32LE(0x10000, 0x10)
    lih.writeBigUInt64LE(BigInt(sample.reader.size!), 0x18)
    lih.writeBigUInt64LE(0x10000n, 0x20)
    lih.writeBigUInt64LE(0x10000n, 0x28)
    lih.writeBigUInt64LE(0x20000n, 0x30)
    lih.writeBigUInt64LE(0x6000n, 0x38)
    const fih = Buffer.alloc(8)
    fih.writeUInt32BE(0x7f464948)
    fih.writeUInt16LE(3, 6)
    sample.chunks[0] = [0, lih]
    sample.chunks.push([0x10000, fih])
    expect(await packageParser.parse(sample.reader)).toMatchObject({
      state: 'ready',
      metadata: { platform: 'ps5', kind: 'patch', titleId: 'PPSA21567' },
    })
    lih.writeBigUInt64LE(0x5a0n, 0x38)
    await expect(packageParser.parse(sample.reader)).rejects.toThrow('条目表')
  })
  it('classifies DLC by the CNT type even without applicationCategoryType', async () => {
    const { applicationCategoryType: _, ...raw } = param
    expect((await packageParser.parse(fixture({ type: 0x21, raw }).reader)).metadata.kind).toBe('dlc')
    expect((await packageParser.parse(fixture({ type: 0x22, raw }).reader)).metadata.kind).toBe('dlc')
    expect((await packageParser.parse(fixture({ flags: 0x00100000 }).reader)).metadata.kind).toBe('patch')
  })
  it('lists and exports public PNG artwork', async () => {
    const { reader } = fixture({ extra: new Map([[0x1006, png]]) })
    expect(await packageParser.asset!(reader, 'artwork')).toEqual(
      expect.arrayContaining([{ id: 0x1006, name: 'pic1.png', size: png.length }]),
    )
    expect(await packageParser.asset!(reader, 'artwork-image', String(0x1006))).toMatchObject({
      status: 'ready',
      data: { preview: true, extension: 'png' },
    })
  })
  it('keeps encrypted or metadata-less packages partial without inventing title/version', async () => {
    const result = await packageParser.parse(fixture({ encrypted: true }).reader)
    expect(result.state).toBe('partial')
    expect(result.metadata.title).toBeUndefined()
    expect(result.metadata.version).toBeUndefined()
    const header = Buffer.alloc(96)
    header.writeUInt32BE(0x7f464948)
    header.writeBigUInt64LE(4096n, 0x58)
    const partial = await packageParser.parse({ size: 96, readRange: async (p, n) => header.subarray(p, p + n) })
    expect(partial.state).toBe('partial')
    expect(partial.message).toContain('密钥')
  })
  it('rejects unsafe offsets, oversized tables and entries outside the file', async () => {
    const header = Buffer.alloc(96)
    header.writeUInt32BE(0x7f464948)
    header.writeBigUInt64LE(2n ** 63n, 0x58)
    await expect(packageParser.parse({ readRange: async (p, n) => header.subarray(p, p + n) })).rejects.toThrow(
      '安全整数',
    )
    const badTable = fixture()
    badTable.cnt.writeUInt32BE(65537, 16)
    await expect(packageParser.parse(badTable.reader)).rejects.toThrow('条目表')
    const badEntry = fixture()
    badEntry.cnt.writeUInt32BE(0xffffffff, 0x5a0 + 16)
    await expect(packageParser.parse(badEntry.reader)).rejects.toThrow('越界')
  })
  it('supports BOM/comments/trailing commas but rejects malformed metadata', () => {
    expect(ps5Json(Buffer.from('\uFEFF{/*publisher*/"titleId":"PPSA12345",}\0'))).toEqual({ titleId: 'PPSA12345' })
    expect(() => ps5Json(Buffer.from('{"titleId":'))).toThrow('元数据')
    expect(() => ps5Json(Buffer.from('[]'))).toThrow('元数据')
  })
  it('reads UCP localized names, grades, hidden flags and icons; validates integrity', async () => {
    const { reader } = fixture({ extra: new Map([[0x1480, ucp()]]) })
    const trophies: any = await packageParser.asset!(reader, 'trophies')
    expect(trophies).toMatchObject({
      status: 'ready',
      data: {
        language: 'zh-Hans',
        metadataName: '宇宙机器人',
        npCommunicationId: 'NPWR12345_00',
        trophies: [
          { grade: '白金', hidden: false },
          { grade: '铜', hidden: true },
        ],
      },
    })
    expect(trophies.data.warning).toBeUndefined()
    expect(trophies.data.trophies[0].icon).toContain('data:image/png;')
    expect(((await packageParser.asset!(reader, 'trophies', 'en-US')) as any).data.language).toBe('en-US')
    const corrupted = ucp()
    corrupted[0x1c] ^= 1
    expect(
      ((await packageParser.asset!(fixture({ extra: new Map([[0x1480, corrupted]]) }).reader, 'trophies')) as any).data
        .warning,
    ).toContain('SHA-1')
  })
  it('does not parse PS4 TRP as PS5 trophy metadata', async () => {
    const bytes = ucp()
    bytes.writeUInt32BE(0xdca24d00)
    await expect(
      packageParser.asset!(fixture({ extra: new Map([[0x1480, bytes]]) }).reader, 'trophies'),
    ).rejects.toThrow('UCP')
  })
})
describe('PS5 DDS images', () => {
  function dds(format: number, width = 4, height = 4) {
    const bytes = Buffer.alloc(148 + 64)
    bytes.write('DDS ')
    bytes.writeUInt32LE(124, 4)
    bytes.writeUInt32LE(height, 12)
    bytes.writeUInt32LE(width, 16)
    bytes.writeUInt32LE(32, 76)
    bytes.write('DX10', 84)
    bytes.writeUInt32LE(format, 128)
    bytes.writeUInt32LE(3, 132)
    bytes.writeUInt32LE(1, 140)
    return bytes
  }
  it('decodes BC7 and preserves RGBA channel order for uncompressed textures', () => {
    const bc7 = ddsToPng(dds(98))
    expect(Buffer.from(bc7).readUInt32BE(16)).toBe(4)
    const rgba = dds(28)
    for (let i = 148; i < rgba.length; i += 4) {
      rgba[i] = 255
      rgba[i + 3] = 255
    }
    expect(readPNG(ddsToPng(rgba)).color_data.slice(1, 5)).toEqual(new Uint8Array([255, 0, 0, 255]))
  })
  it('rejects truncated blocks, huge dimensions and unsupported texture arrays before decoding', () => {
    expect(() => ddsToPng(dds(98).subarray(0, 149))).toThrow('无效')
    expect(() => ddsToPng(dds(98, 100000, 100000))).toThrow('无效')
    const array = dds(98)
    array.writeUInt32LE(2, 140)
    expect(() => ddsToPng(array)).toThrow('无效')
    expect(() => ddsToPng(dds(999))).toThrow('暂不支持')
  })
})
