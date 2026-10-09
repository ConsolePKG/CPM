import { Buffer } from 'buffer'
import { parse as parseJson, type ParseError } from 'jsonc-parser'
import type { Artwork, ArtworkImage, Resource } from '@njzy/ps4-pkg-info/resources'
import { LibraryError, type ByteReader, type ParseResult, type ResourceKind } from './types'
import { ddsToPng, isPng } from './ps5Images'
import { ps5Trophies } from './ps5Trophies'

// Public CNT/FIH layout cross-checked with PkgViewer/PS5PKGTool and real FIH packages.
// Implemented independently: payloads in an embedded CNT are relative to that CNT, not the file.
export async function readPs5Range(reader: ByteReader, offset: number, size: number, signal?: AbortSignal) {
  signal?.throwIfAborted()
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > 32 * 1024 * 1024 ||
    !Number.isSafeInteger(offset + size) ||
    (reader.size !== undefined && offset + size > reader.size)
  )
    throw new LibraryError('invalid_range', 'PS5 PKG 资源范围无效或超出限制')
  const bytes = await reader.readRange(offset, size, signal)
  if (bytes.length !== size) throw new LibraryError('short_read', 'PS5 PKG 数据不完整')
  return Buffer.from(bytes)
}
export function safeU64(bytes: Buffer, offset: number, littleEndian = false) {
  const value = littleEndian ? bytes.readBigUInt64LE(offset) : bytes.readBigUInt64BE(offset)
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new LibraryError('invalid_range', 'PS5 PKG 偏移超出安全整数范围')
  return Number(value)
}
export function ps5Json(bytes: Uint8Array): Record<string, any> {
  const errors: ParseError[] = []
  const json = new TextDecoder('utf-8', { fatal: true })
    .decode(bytes)
    .replace(/^\uFEFF/, '')
    .replace(/\0+$/, '')
  const result = parseJson(json, errors, { allowTrailingComma: true })
  if (errors.length || !result || typeof result !== 'object' || Array.isArray(result))
    throw new LibraryError('invalid_metadata', 'PS5 JSON 元数据格式无效')
  return result
}
type Entry = { id: number; nameOffset: number; offset: number; size: number; encrypted: boolean }
export async function isPs5(reader: ByteReader, signal?: AbortSignal) {
  const magic = await reader.readRange(0, 4, signal)
  if (magic.length !== 4) return false
  const kind = Buffer.from(magic).toString('hex')
  if (kind === '7f464948' || kind === '7f4c4948') return true
  if (kind !== '7f434e54') return false
  // PS4 CNT shares the magic, but has a different version and content-type encoding.
  const header = await reader.readRange(4, 12, signal)
  return (
    header.length === 12 &&
    header[0] === 0 &&
    header[1] >= 1 &&
    header[1] <= 8 &&
    Buffer.from(header).readUInt32BE(8) === 12
  )
}
export async function openPs5(reader: ByteReader, signal?: AbortSignal) {
  const probe = await readPs5Range(reader, 0, 0x60, signal)
  const magic = probe.toString('ascii', 1, 4)
  let cntOffset = 0
  let patch = false
  let cntSize: number | undefined
  if (magic === 'FIH') cntOffset = safeU64(probe, 0x58, true)
  else if (magic === 'LIH') {
    // LIH v1 has explicit FIH and CNT segments; its CNT is not at FIH's 0x58 offset.
    if (probe.readUInt16LE(6) !== 1 || safeU64(probe, 0x20, true) !== 0x10000)
      throw new LibraryError('invalid_package', 'PS5 LIH 补丁头部版本或大小无效')
    const fihOffset = probe.readUInt32LE(0x10),
      fihSize = safeU64(probe, 0x28, true)
    cntOffset = safeU64(probe, 0x30, true)
    cntSize = safeU64(probe, 0x38, true)
    if (
      fihOffset !== 0x10000 ||
      fihSize < 8 ||
      cntSize < 0x5a0 ||
      cntOffset < fihOffset + fihSize ||
      !Number.isSafeInteger(cntOffset + cntSize) ||
      (reader.size !== undefined && (safeU64(probe, 0x18, true) !== reader.size || cntOffset + cntSize > reader.size))
    )
      throw new LibraryError('invalid_package', 'PS5 LIH 补丁分段越界或大小不匹配')
    const fih = await readPs5Range(reader, fihOffset, 8, signal)
    if (fih.readUInt32BE(0) !== 0x7f464948) throw new LibraryError('invalid_package', 'PS5 LIH 内部 FIH 头部无效')
    patch = true
  } else if (magic !== 'CNT') throw new LibraryError('invalid_package', '不是 PS5 PKG')
  if (magic === 'FIH' && (!cntOffset || (reader.size !== undefined && cntOffset + 0x5a0 > reader.size)))
    return {
      entries: new Map<number, Entry>(),
      contentId: undefined,
      contentType: 0,
      contentFlags: 0,
      patch,
      get: async (): Promise<Resource<Buffer>> => ({
        status: 'unavailable',
        message: 'PS5 PKG 未包含公开 CNT 元数据；读取加密 PFS 需要匹配的密钥',
      }),
    }
  const header = await readPs5Range(reader, cntOffset, 0x5a0, signal)
  if (header.readUInt32BE(0) !== 0x7f434e54) throw new LibraryError('invalid_package', 'PS5 嵌入的 CNT 头部无效')
  const count = header.readUInt32BE(0x10),
    tableOffset = header.readUInt32BE(0x18)
  if (count > 65536 || (count && tableOffset < 0x5a0) || (cntSize !== undefined && tableOffset + count * 32 > cntSize))
    throw new LibraryError('invalid_package', 'PS5 条目表无效')
  const table = count ? await readPs5Range(reader, cntOffset + tableOffset, count * 32, signal) : Buffer.alloc(0)
  const entries = new Map<number, Entry>()
  for (let p = 0; p < table.length; p += 32) {
    const id = table.readUInt32BE(p),
      offset = cntOffset + table.readUInt32BE(p + 16),
      size = table.readUInt32BE(p + 20)
    if (
      entries.has(id) ||
      (reader.size !== undefined && offset + size > reader.size) ||
      (cntSize !== undefined && offset + size > cntOffset + cntSize)
    )
      throw new LibraryError('invalid_package', 'PS5 条目重复或越界')
    entries.set(id, {
      id,
      nameOffset: table.readUInt32BE(p + 4),
      offset,
      size,
      encrypted: Boolean(table.readUInt32BE(p + 8) & 0x80000000),
    })
  }
  const contentId = header.toString('ascii', 0x40, 0x70).replace(/\0.*$/, '').trim() || undefined
  const contentType = header.readUInt32BE(0x74),
    contentFlags = header.readUInt32BE(0x78)
  patch ||= Boolean(contentFlags & 0x00100000)
  const get = async (id: number, limit = 16 * 1024 * 1024): Promise<Resource<Buffer>> => {
    const entry = entries.get(id)
    if (!entry) return { status: 'missing', message: '此 PS5 PKG 未包含该资源' }
    if (entry.encrypted) return { status: 'unavailable', message: 'PS5 PKG 条目已加密，需要匹配的密钥' }
    if (!entry.size || entry.size > limit) throw new LibraryError('invalid_range', 'PS5 PKG 资源大小超出限制')
    return { status: 'ready', data: await readPs5Range(reader, entry.offset, entry.size, signal) }
  }
  return { entries, contentId, contentType, contentFlags, patch, get }
}
export type Ps5Package = Awaited<ReturnType<typeof openPs5>>
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined)
function titleOf(raw: Record<string, any>) {
  const localized = raw.localizedParameters
  if (!localized || typeof localized !== 'object') return undefined
  for (const language of ['zh-Hans', 'zh-Hant', localized.defaultLanguage, 'en-US', ...Object.keys(localized)]) {
    const title = text(localized[language]?.titleName)
    if (title) return title
  }
}
export async function parsePs5(reader: ByteReader, signal?: AbortSignal): Promise<ParseResult> {
  const pkg = await openPs5(reader, signal)
  const param = await pkg.get(0x2000)
  const raw = param.status === 'ready' ? ps5Json(param.data) : {}
  const contentId = text(raw.contentId) || pkg.contentId
  const titleId = text(raw.titleId) || contentId?.match(/(?:^|-)PPSA\d{5}(?=_)/)?.[0].replace(/^-/, '')
  const kind: ResourceKind =
    pkg.patch || raw.applicationCategoryType === 2
      ? 'patch'
      : [0x21, 0x22].includes(pkg.contentType) || raw.applicationCategoryType === 1
        ? 'dlc'
        : pkg.contentType === 0x20 || typeof raw.applicationCategoryType === 'number'
          ? 'base'
          : 'unknown'
  const warnings: string[] = []
  if (param.status !== 'ready') warnings.push(param.message)
  let cover: Uint8Array | undefined
  // Covers are optional; failure must not discard valid metadata or suppress other games.
  for (const id of [0x1200, 0x1280]) {
    try {
      const icon = await pkg.get(id)
      if (icon.status === 'ready') {
        cover = isPng(icon.data) ? Uint8Array.from(icon.data) : ddsToPng(icon.data)
        break
      }
    } catch (error) {
      signal?.throwIfAborted()
      warnings.push(`封面：${(error as Error).message}`)
    }
  }
  return {
    state: titleId && contentId && text(raw.contentVersion) && titleOf(raw) && kind !== 'unknown' ? 'ready' : 'partial',
    metadata: {
      platform: 'ps5',
      format: 'ps5-pkg',
      kind,
      title: titleOf(raw),
      titleId,
      contentId,
      version: text(raw.contentVersion),
      masterVersion: text(raw.masterVersion),
      requiredSystemVersion: text(raw.requiredSystemSoftwareVersion),
      raw,
    },
    cover,
    message: warnings.join('；') || undefined,
  }
}
function imageName(id: number): string | undefined {
  const names: Record<number, string> = {
    0x1200: 'icon0.png',
    0x1220: 'pic0.png',
    0x1006: 'pic1.png',
    0x1280: 'icon0.dds',
    0x12a0: 'pic0.dds',
    0x12c0: 'pic1.dds',
    0x2040: 'pic2.png',
    0x2060: 'pic2.dds',
  }
  if (names[id]) return names[id]
  for (const [start, prefix, ext] of [
    [0x1201, 'icon0', 'png'],
    [0x1221, 'pic0', 'png'],
    [0x1281, 'icon0', 'dds'],
    [0x12a1, 'pic0', 'dds'],
    [0x12c1, 'pic1', 'dds'],
  ] as const)
    if (id >= start && id < start + 31) return `${prefix}_${String(id - start + 1).padStart(2, '0')}.${ext}`
}
export async function ps5Asset(reader: ByteReader, kind: string, key?: string) {
  const pkg = await openPs5(reader)
  if (kind === 'trophies') return ps5Trophies(reader, pkg, key)
  if (kind === 'artwork') {
    const names = pkg.entries.has(0x200) ? await pkg.get(0x200, 4 * 1024 * 1024) : undefined
    const images: Artwork = []
    for (const entry of pkg.entries.values()) {
      let name = imageName(entry.id)
      if (names?.status === 'ready' && entry.nameOffset < names.data.length) {
        const end = names.data.indexOf(0, entry.nameOffset)
        if (end > entry.nameOffset && end - entry.nameOffset <= 1024)
          name = names.data.toString('utf8', entry.nameOffset, end)
      }
      if (name && /\.(png|dds)$/i.test(name)) images.push({ id: entry.id, name, size: entry.size })
    }
    return images
  }
  if (kind !== 'artwork-image') throw new LibraryError('unsupported_asset', 'Unsupported resource kind')
  const id = Number(key)
  if (!Number.isInteger(id) || !imageName(id)) throw new LibraryError('unsupported_asset', '无效的 PS5 艺术图编号')
  const result = await pkg.get(id)
  if (result.status !== 'ready') return result
  let png: Uint8Array
  try {
    png = isPng(result.data) ? result.data : ddsToPng(result.data)
  } catch (error) {
    if (error instanceof LibraryError && error.code === 'unsupported_image')
      return {
        status: 'ready',
        data: {
          url: `data:application/octet-stream;base64,${result.data.toString('base64')}`,
          extension: 'dds',
          preview: false,
        },
      } satisfies Resource<ArtworkImage>
    throw error
  }
  return {
    status: 'ready',
    data: { url: `data:image/png;base64,${Buffer.from(png).toString('base64')}`, extension: 'png', preview: true },
  } satisfies Resource<ArtworkImage>
}
