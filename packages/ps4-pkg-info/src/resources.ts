import { Buffer } from 'buffer'
import type { CustomSeek } from './core'
import { parseTrophies, type TrophySet } from './trophies'
import { deriveVerifiedEntryKey, decryptPkgEntry } from './entryCrypto'

export type Resource<T> = { status: 'ready'; data: T } | { status: 'missing' | 'unavailable'; message: string }
export type ArtworkEntry = { id: number; name: string; size: number }
export type Artwork = ArtworkEntry[]
export type ArtworkImage = { url: string; extension: string; preview: boolean }
export type ResourceOptions = { signal?: AbortSignal; language?: string }
export type { TrophySet, Trophy, TrophyLanguage } from './trophies'
const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
export const pngUrl = (bytes: Buffer): string => {
  if (!bytes.subarray(0, 8).equals(PNG)) throw new Error('图片不是有效的 PNG')
  return `data:image/png;base64,${bytes.toString('base64')}`
}
type Entry = { id: number; offset: number; size: number; encrypted: boolean; raw: Buffer; keyIndex: number }

export async function openResources(source: CustomSeek) {
  const read = async (offset: number, size: number) => {
    if (!Number.isSafeInteger(offset) || offset < 0 || size < 1 || size > 32 * 1024 * 1024)
      throw new Error('PKG 资源范围超出限制')
    const bytes = await source.seekChunk(offset, offset + size - 1)
    if (bytes.length !== size) throw new Error('PKG 资源数据不完整')
    return bytes
  }
  const header = await read(0, 32)
  if (header.readUInt32BE(0) !== 0x7f434e54) throw new Error('不是 PS4 PKG 文件')
  const count = header.readUInt32BE(0x10)
  if (count > 65536) throw new Error('PKG 条目数量超出限制')
  const table = count ? await read(header.readUInt32BE(0x18), count * 32) : Buffer.alloc(0)
  const entries = new Map<number, Entry>()
  for (let i = 0; i < count; i++) {
    const p = i * 32
    const id = table.readUInt32BE(p)
    if (entries.has(id)) throw new Error('PKG 存在重复资源条目')
    entries.set(id, {
      id,
      raw: table.subarray(p, p + 32),
      keyIndex: (table.readUInt32BE(p + 12) >>> 12) & 15,
      offset: table.readUInt32BE(p + 16),
      size: table.readUInt32BE(p + 20),
      encrypted: Boolean(table.readUInt32BE(p + 8) & 0x80000000),
    })
  }
  let keyMaterial: Promise<{ contentId: Buffer; keyTable: Buffer } | undefined> | undefined
  const get = async (id: number, limit = 32 * 1024 * 1024): Promise<Resource<Buffer>> => {
    const entry = entries.get(id)
    if (!entry) return { status: 'missing', message: '此 PKG 未包含该资源' }
    if (!entry.size || entry.size > limit) throw new Error('PKG 资源大小无效或超出限制')
    if (entry.encrypted) {
      keyMaterial ??= (async () => {
        const keys = entries.get(0x10)
        if (!keys || keys.encrypted || keys.size < 256) return
        return { contentId: await read(0x40, 48), keyTable: await read(keys.offset, 256) }
      })()
      const material = await keyMaterial
      const key = material && deriveVerifiedEntryKey(material.contentId, material.keyTable, entry.keyIndex)
      if (!key) return { status: 'unavailable', message: 'PKG 条目已加密：默认 FPKG 口令无法验证，或缺少密钥表' }
      const stored = Math.ceil(entry.size / 16) * 16
      if (stored > limit) throw new Error('加密 PKG 资源大小超出限制')
      return { status: 'ready', data: decryptPkgEntry(await read(entry.offset, stored), entry.raw, key, entry.size) }
    }
    return { status: 'ready', data: await read(entry.offset, entry.size) }
  }
  return { get, entries }
}

function standardImageName(id: number): string | undefined {
  const single: Record<number, string> = {
    0x1006: 'pic1.png',
    0x100c: 'shareoverlayimage.png',
    0x100d: 'save_data.png',
    0x100e: 'shareprivacyguardimage.png',
    0x1200: 'icon0.png',
    0x1220: 'pic0.png',
    0x1280: 'icon0.dds',
    0x12a0: 'pic0.dds',
    0x12c0: 'pic1.dds',
  }
  if (single[id]) return single[id]
  for (const [start, prefix, extension] of [
    [0x1201, 'icon0', 'png'],
    [0x1241, 'pic1', 'png'],
    [0x1281, 'icon0', 'dds'],
    [0x12c1, 'pic1', 'dds'],
  ] as const) {
    if (id >= start && id <= start + 30) return `${prefix}_${String(id - start).padStart(2, '0')}.${extension}`
  }
}
export async function extractArtwork(source: CustomSeek): Promise<Artwork> {
  try {
    const { get, entries } = await openResources(source)
    const names = await get(0x200, 4 * 1024 * 1024)
    const images: Artwork = []
    for (const entry of entries.values()) {
      let name: string | undefined
      if (names.status === 'ready') {
        const offset = entry.raw.readUInt32BE(4)
        const end = names.data.indexOf(0, offset)
        if (offset < names.data.length && end > offset && end - offset <= 1024)
          name = names.data.toString('utf8', offset, end)
      }
      name ||= standardImageName(entry.id)
      if (name && /\.(png|jpe?g|webp|gif|bmp|dds)$/i.test(name)) images.push({ id: entry.id, name, size: entry.size })
    }
    return images
  } finally {
    source.destroyAll?.()
  }
}
export async function extractArtworkImage(source: CustomSeek, id: number): Promise<Resource<ArtworkImage>> {
  try {
    const { get } = await openResources(source)
    const result = await get(id, 16 * 1024 * 1024)
    if (result.status !== 'ready') return result
    const bytes = result.data
    let extension: string
    if (bytes.subarray(0, 8).equals(PNG)) extension = 'png'
    else if (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) extension = 'jpg'
    else if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') extension = 'webp'
    else if (/^GIF8[79]a$/.test(bytes.toString('ascii', 0, 6))) extension = 'gif'
    else if (bytes.toString('ascii', 0, 2) === 'BM') extension = 'bmp'
    else if (bytes.toString('ascii', 0, 4) === 'DDS ') extension = 'dds'
    else throw new Error('不支持或无效的图片格式')
    const mime = extension === 'dds' ? 'application/octet-stream' : `image/${extension === 'jpg' ? 'jpeg' : extension}`
    return {
      status: 'ready',
      data: { url: `data:${mime};base64,${bytes.toString('base64')}`, extension, preview: extension !== 'dds' },
    }
  } finally {
    source.destroyAll?.()
  }
}

export async function extractTrophies(source: CustomSeek, language = 'default'): Promise<Resource<TrophySet>> {
  try {
    const { get } = await openResources(source)
    const trp = await get(0x1400)
    if (trp.status !== 'ready') return trp
    const ids = new Set<string>()
    const bindingIssues: string[] = []
    for (const id of [0x403, 0x402]) {
      const result = await get(id, 1024 * 1024)
      if (result.status !== 'ready')
        bindingIssues.push(`${id === 0x403 ? 'npbind.dat' : 'nptitle.dat'}：${result.message}`)
      if (result.status === 'ready') {
        for (const encoding of ['ascii', 'utf16le'] as const) {
          for (const match of result.data.toString(encoding).matchAll(/\bNPWR\d{5}_\d{2}\b/g)) ids.add(match[0])
        }
      }
    }
    const data = parseTrophies(trp.data, [...ids], language)
    if (data.warning && !ids.size && bindingIssues.length) data.warning += `（${bindingIssues.join('；')}）`
    return { status: 'ready', data }
  } finally {
    source.destroyAll?.()
  }
}
