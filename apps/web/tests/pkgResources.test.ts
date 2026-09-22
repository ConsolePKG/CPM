import { describe, expect, it, rstest as vi, afterEach } from '@rstest/core'
import { Buffer } from 'buffer'
import { createCipheriv, createHash } from 'node:crypto'
import { extractArtwork, extractArtworkImage, extractTrophies } from '../../../packages/ps4-pkg-info/src/resources'
import { decryptEsfm, parseTrophies, parseTrophyXml, readTrp } from '../../../packages/ps4-pkg-info/src/trophies'
import { createResourceReader } from '../../../packages/ps4-pkg-info/src/web/resourceReader'
import { extract } from '../../../packages/ps4-pkg-info/src/core'
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=',
  'base64',
)
const npwr = 'NPWR12345_00'
const xml = Buffer.from(
  `<trophyconf><npcommid>${npwr}</npcommid><group id="1"><name>扩展包</name></group><trophy id="0" ttype="P" hidden="yes" gid="1"><name>完成 &amp; 收藏</name><detail>获得所有奖杯</detail></trophy></trophyconf>`,
)
function encrypt(xmlBytes: Buffer, id = npwr) {
  const input = Buffer.alloc(16)
  input.write(id)
  const derive = createCipheriv('aes-128-cbc', Buffer.from('21f41a6bad8a1d3eca7ad586c101b7a9', 'hex'), Buffer.alloc(16))
  derive.setAutoPadding(false)
  const key = Buffer.concat([derive.update(input), derive.final()])
  const cipher = createCipheriv('aes-128-cbc', key, Buffer.alloc(16))
  return Buffer.concat([cipher.update(Buffer.concat([Buffer.alloc(16), xmlBytes])), cipher.final()])
}
function trp(items: { name: string; data: Buffer; flags?: number }[], version = 3) {
  const header = version === 3 ? 96 : 64
  let offset = header + items.length * 64
  const result = Buffer.alloc(offset + items.reduce((n, item) => n + item.data.length, 0))
  result.writeUInt32BE(0xdca24d00, 0)
  result.writeUInt32BE(version, 4)
  result.writeUInt32BE(result.length, 12)
  result.writeUInt32BE(items.length, 16)
  result.writeUInt32BE(64, 20)
  items.forEach((item, i) => {
    const p = header + i * 64
    result.write(item.name, p, 32)
    result.writeUInt32BE(offset, p + 36)
    result.writeUInt32BE(item.data.length, p + 44)
    result.writeUInt32BE(item.flags || 0, p + 48)
    item.data.copy(result, offset)
    offset += item.data.length
  })
  return result
}
function pkg(items: { id: number; data: Buffer; encrypted?: boolean; nameOffset?: number }[]) {
  let offset = 32 + items.length * 32
  const result = Buffer.alloc(offset + items.reduce((n, item) => n + item.data.length, 0))
  result.writeUInt32BE(0x7f434e54, 0)
  result.writeUInt32BE(items.length, 16)
  result.writeUInt32BE(32, 24)
  items.forEach((item, i) => {
    const p = 32 + i * 32
    result.writeUInt32BE(item.id, p)
    result.writeUInt32BE(item.nameOffset || 0, p + 4)
    result.writeUInt32BE(item.encrypted ? 0x80000000 : 0, p + 8)
    result.writeUInt32BE(offset, p + 16)
    result.writeUInt32BE(item.data.length, p + 20)
    item.data.copy(result, offset)
    offset += item.data.length
  })
  const seekChunk = vi.fn(async (start: number, end?: number) => result.subarray(start, (end ?? start) + 1))
  const destroyAll = vi.fn()
  return { bytes: result, seekChunk, destroyAll }
}
afterEach(() => vi.unstubAllGlobals())
describe('optional PKG resources', () => {
  it('does not read artwork or trophies during ordinary icon parsing', async () => {
    const source = pkg([
      { id: 0x1200, data: png },
      { id: 0x1220, data: png },
      { id: 0x1400, data: Buffer.alloc(100) },
    ])
    await extract({ ...source, generateParamSfo: false })
    expect(source.seekChunk).toHaveBeenCalledTimes(3)
    expect(source.seekChunk.mock.calls[2][0]).toBe(128)
  })
  it('extracts PIC0 and PIC1 from their actual PS4 IDs and closes the reader', async () => {
    const source = pkg([
      { id: 0x1220, data: png },
      { id: 0x1006, data: png },
    ])
    const art = await extractArtwork(source)
    expect(art.map((item) => item.name)).toEqual(['pic0.png', 'pic1.png'])
    expect(source.seekChunk).toHaveBeenCalledTimes(2)
    const image = await extractArtworkImage(pkg([{ id: 0x1220, data: png }]), 0x1220)
    expect(image).toEqual({
      status: 'ready',
      data: { url: `data:image/png;base64,${png.toString('base64')}`, extension: 'png', preview: true },
    })
    expect(source.destroyAll).toHaveBeenCalledTimes(1)
  })
  it('distinguishes missing resources and encrypted entries', async () => {
    const art = await extractArtwork(pkg([{ id: 0x1220, data: png, encrypted: true }]))
    expect(art).toHaveLength(1)
    expect((await extractArtworkImage(pkg([{ id: 0x1220, data: png, encrypted: true }]), 0x1220)).status).toBe(
      'unavailable',
    )
    expect(await extractArtwork(pkg([]))).toEqual([])
    expect((await extractTrophies(pkg([]))).status).toBe('missing')
  })
  it('rejects truncated resources and oversized tables without reading their payload', async () => {
    const source = pkg([{ id: 0x1220, data: png }])
    source.bytes.writeUInt32BE(0xffffff, 52)
    await expect(extractArtworkImage(source, 0x1220)).rejects.toThrow()
    expect(source.destroyAll).toHaveBeenCalledTimes(1)
    const huge = pkg([])
    huge.bytes.writeUInt32BE(1000000, 16)
    await expect(extractArtwork(huge)).rejects.toThrow('条目数量')
    expect(huge.seekChunk).toHaveBeenCalledTimes(1)
  })
  it('discovers custom names and localized entries without reading image bodies', async () => {
    const source = pkg([
      { id: 0x200, data: Buffer.from('\0art/banner.JPG\0') },
      { id: 0x7777, data: Buffer.from([255, 216, 255]), nameOffset: 1 },
      { id: 0x124b, data: png },
      { id: 0x1240, data: Buffer.from('audio') },
      { id: 0x1280, data: Buffer.from('DDS ') },
    ])
    expect((await extractArtwork(source)).map((entry) => entry.name)).toEqual([
      'art/banner.JPG',
      'pic1_10.png',
      'icon0.dds',
    ])
    expect(source.seekChunk).toHaveBeenCalledTimes(3)
    expect(await extractArtworkImage(pkg([{ id: 0x7777, data: Buffer.from('DDS ') }]), 0x7777)).toMatchObject({
      status: 'ready',
      data: { extension: 'dds', preview: false },
    })
  })
  it('ignores invalid name offsets and rejects unsupported image content', async () => {
    expect(
      await extractArtwork(
        pkg([
          { id: 0x200, data: Buffer.from('\0broken.png') },
          { id: 0x7777, data: png, nameOffset: 999 },
        ]),
      ),
    ).toEqual([])
    await expect(extractArtworkImage(pkg([{ id: 0x1220, data: Buffer.from('not an image') }]), 0x1220)).rejects.toThrow(
      '图片格式',
    )
  })
  it('reads NPWR binding and encrypted trophy metadata with icons end to end', async () => {
    const data = trp([
      { name: 'TROP.ESFM', data: encrypt(xml), flags: 3 },
      { name: 'TROP000.PNG', data: png },
    ])
    const result = await extractTrophies(
      pkg([
        { id: 0x1400, data },
        { id: 0x403, data: Buffer.from(npwr) },
      ]),
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.data.warning).toBeUndefined()
      expect(result.data.trophies[0]).toMatchObject({
        id: 0,
        name: '完成 & 收藏',
        description: '获得所有奖杯',
        grade: '白金',
        hidden: true,
        group: '扩展包',
      })
      expect(result.data.trophies[0].icon).toContain('data:image/png;base64,')
    }
  })
})
describe('TRP / ESFM validation', () => {
  it('supports version 1, 2, 3 archives and plaintext SFM/XML', () => {
    for (const version of [1, 2, 3]) {
      const result = parseTrophies(trp([{ name: 'TROPCONF.SFM', data: xml }], version), npwr)
      expect(result.trophies[0].name).toBe('完成 & 收藏')
    }
  })
  it('decrypts a Node crypto vector and rejects the wrong key', () => {
    expect(decryptEsfm(encrypt(xml), npwr)).toEqual(xml)
    expect(() => decryptEsfm(encrypt(xml), 'NPWR54321_00')).toThrow('解密失败')
  })
  it('preserves icons with a warning when metadata is inaccessible', () => {
    const result = parseTrophies(
      trp([
        { name: 'TROP.ESFM', data: encrypt(xml), flags: 3 },
        { name: 'TROP000.PNG', data: png },
      ]),
    )
    expect(result.warning).toContain('NPWR')
    expect(result.trophies[0].icon).toBeTruthy()
  })
  it('rejects out-of-range TRP entries, bad XML, duplicate IDs and identity mismatch', () => {
    const data = trp([{ name: 'TROP.SFM', data: xml }])
    data.writeUInt32BE(0xffffffff, 132)
    expect(() => readTrp(data)).toThrow('越界')
    expect(() => parseTrophyXml(Buffer.from('<!DOCTYPE x><trophyconf/>'))).toThrow()
    expect(() => parseTrophyXml(Buffer.from('<trophyconf>'))).toThrow()
    expect(() => parseTrophyXml(xml, 'NPWR54321_00')).toThrow('不匹配')
    expect(() => parseTrophyXml(Buffer.from('<trophyconf><trophy id="1"/><trophy id="1"/></trophyconf>'))).toThrow(
      '重复',
    )
  })
})
describe('bounded HTTP resource reader', () => {
  it('reads binary partial responses on browsers without response streams', async () => {
    const arrayBuffer = vi.fn(async () => new Uint8Array([1, 2]).buffer)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 206,
        body: null,
        headers: new Headers({ 'Content-Length': '2' }),
        arrayBuffer,
      })),
    )
    const reader = createResourceReader('http://nas/game.pkg')
    expect(await reader.seekChunk(0, 1)).toEqual(Buffer.from([1, 2]))
    expect(arrayBuffer).toHaveBeenCalledTimes(1)
    reader.destroyAll?.()
  })
  it('does not buffer a full PKG when streams are unavailable and Range is ignored', async () => {
    const arrayBuffer = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 200,
        body: null,
        headers: new Headers(),
        arrayBuffer,
      })),
    )
    const reader = createResourceReader('http://nas/game.pkg')
    await expect(reader.seekChunk(0, 1)).rejects.toThrow('Range')
    expect(arrayBuffer).not.toHaveBeenCalled()
    reader.destroyAll?.()
  })
  it('preserves query strings and Basic auth while requesting exact ranges', async () => {
    const fetcher = vi.fn(
      async () => new Response(new Uint8Array([1, 2]), { status: 206, headers: { 'Content-Range': 'bytes 10-11/20' } }),
    )
    vi.stubGlobal('fetch', fetcher)
    const reader = createResourceReader('http://user:pass@nas/game.pkg?token=abc')
    expect(await reader.seekChunk(10, 11)).toEqual(Buffer.from([1, 2]))
    expect(fetcher.mock.calls[0][0]).toBe('http://nas/game.pkg?token=abc')
    expect(fetcher.mock.calls[0][1].headers).toEqual({ Range: 'bytes=10-11', Authorization: 'Basic dXNlcjpwYXNz' })
    reader.destroyAll?.()
  })
  it('rejects ignored ranges and incorrect lengths', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Uint8Array([1, 2]), { status: 200 })),
    )
    const reader = createResourceReader('http://nas/game.pkg')
    await expect(reader.seekChunk(0, 1)).rejects.toThrow('Range')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 206 })),
    )
    await expect(reader.seekChunk(0, 1)).rejects.toThrow('超出')
    reader.destroyAll?.()
  })
})

function encryptedBindingPackage(validKey = true) {
  const hash = (b: Buffer) => createHash('sha256').update(b).digest()
  const cid = Buffer.alloc(48)
  cid.write('UP0001-CUSA12345_00-0000000000000000')
  const index = Buffer.alloc(4)
  index.writeUInt32BE(3)
  const key = hash(Buffer.concat([hash(index), hash(cid), Buffer.from('0'.repeat(32))]))
  const binding = Buffer.alloc(532)
  binding.write(npwr, 35)
  const trophy = trp([
    { name: 'TROP.ESFM', data: encrypt(xml), flags: 3 },
    { name: 'TROP000.PNG', data: png },
  ])
  const bytes = Buffer.alloc(0x500 + trophy.length)
  bytes.writeUInt32BE(0x7f434e54, 0)
  bytes.writeUInt32BE(3, 16)
  bytes.writeUInt32BE(0x80, 24)
  cid.copy(bytes, 0x40)
  const record = (pos: number, id: number, offset: number, size: number) => {
    bytes.writeUInt32BE(id, pos)
    bytes.writeUInt32BE(offset, pos + 16)
    bytes.writeUInt32BE(size, pos + 20)
  }
  record(0x80, 0x10, 0x100, 256)
  record(0xa0, 0x403, 0x200, binding.length)
  bytes.writeUInt32BE(0x80000000, 0xa8)
  bytes.writeUInt32BE(0x3000, 0xac)
  record(0xc0, 0x1400, 0x500, trophy.length)
  const digest = hash(key).map((b, i) => b ^ key[i])
  digest.copy(bytes, 0x100 + 32 + 3 * 32)
  if (!validKey) bytes[0x100 + 32 + 3 * 32] ^= 1
  const material = hash(Buffer.concat([bytes.subarray(0xa0, 0xc0), key]))
  const cipher = createCipheriv('aes-128-cbc', material.subarray(16), material.subarray(0, 16))
  cipher.setAutoPadding(false)
  const padded = Buffer.alloc(544)
  binding.copy(padded)
  Buffer.concat([cipher.update(padded), cipher.final()]).copy(bytes, 0x200)
  trophy.copy(bytes, 0x500)
  return { seekChunk: async (start: number, end?: number) => bytes.subarray(start, (end ?? start) + 1) }
}
describe('encrypted NPWR bindings', () => {
  it('decrypts trophies without DataView.setBigUint64 on old WebKit', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(DataView.prototype, 'setBigUint64')!
    Object.defineProperty(DataView.prototype, 'setBigUint64', { configurable: true, value: undefined })
    try {
      const result = await extractTrophies(encryptedBindingPackage())
      expect(result.status).toBe('ready')
      if (result.status === 'ready') expect(result.data.trophies[0].name).toBe('完成 & 收藏')
    } finally {
      Object.defineProperty(DataView.prototype, 'setBigUint64', descriptor)
    }
  })
  it('decrypts a 532-byte binding from 544 stored bytes using a verified default-passcode key', async () => {
    const result = await extractTrophies(encryptedBindingPackage())
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.data.warning).toBeUndefined()
      expect(result.data.npCommunicationId).toBe(npwr)
      expect(result.data.trophies[0].name).toBe('完成 & 收藏')
    }
  })
  it('rejects an unverified default key and explains why NPWR is unavailable', async () => {
    const result = await extractTrophies(encryptedBindingPackage(false))
    if (result.status !== 'ready') throw new Error('expected icons')
    expect(result.data.warning).toContain('默认 FPKG 口令无法验证')
    expect(result.data.trophies[0].icon).toBeTruthy()
  })
  it('selects the matching candidate only after decryption and XML identity verification', () => {
    const result = parseTrophies(trp([{ name: 'TROP.ESFM', data: encrypt(xml), flags: 3 }]), ['NPWR99999_00', npwr])
    expect(result.warning).toBeUndefined()
    expect(result.npCommunicationId).toBe(npwr)
  })
})

it('decodes numeric XML character references in trophy descriptions', () => {
  const value = Buffer.from(
    '<trophyconf><trophy id="0"><name>A</name><detail>Line 1&#x0a;Line 2 &#38; more</detail></trophy></trophyconf>',
  )
  expect(parseTrophyXml(value).trophies[0].description).toBe('Line 1\nLine 2 & more')
})

describe('trophy language selection', () => {
  const multilingual = () =>
    trp([
      { name: 'TROP.ESFM', data: encrypt(xml), flags: 3 },
      {
        name: 'TROP_10.ESFM',
        data: encrypt(Buffer.from(xml.toString().replace('完成 &amp; 收藏', '繁體獎盃'))),
        flags: 3,
      },
      {
        name: 'TROP_11.ESFM',
        data: encrypt(Buffer.from(xml.toString().replace('完成 &amp; 收藏', '简体奖杯'))),
        flags: 3,
      },
    ])
  it('keeps default text and lists only embedded languages', () => {
    const result = parseTrophies(multilingual(), npwr)
    expect(result.trophies[0].name).toBe('完成 & 收藏')
    expect(result.language).toBe('default')
    expect(result.availableLanguages).toEqual([
      { id: '10', label: '繁体中文' },
      { id: '11', label: '简体中文' },
      { id: 'default', label: '默认语言' },
    ])
  })
  it('decrypts the selected language without substituting another one', () => {
    expect(parseTrophies(multilingual(), npwr, '10').trophies[0].name).toBe('繁體獎盃')
    expect(parseTrophies(multilingual(), npwr, '11').trophies[0].name).toBe('简体奖杯')
    expect(parseTrophies(multilingual(), npwr, '01').warning).toContain('未包含所选语言')
  })
  it('keeps the language list when selected metadata is damaged', () => {
    const data = trp([
      { name: 'TROP.SFM', data: xml },
      { name: 'TROP_11.ESFM', data: Buffer.alloc(32), flags: 3 },
    ])
    const result = parseTrophies(data, npwr, '11')
    expect(result.warning).toBeTruthy()
    expect(result.availableLanguages).toContainEqual({ id: '11', label: '简体中文' })
    expect(result.metadataName).toBeUndefined()
  })
})
