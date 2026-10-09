import { Buffer } from 'buffer'
import { sha1 } from '@noble/hashes/legacy.js'
import type { Resource, TrophySet, Trophy } from '@njzy/ps4-pkg-info/resources'
import { type ByteReader, LibraryError } from './types'
import { ps5Json, safeU64, type Ps5Package } from './ps5'
import { isPng } from './ps5Images'

/** Public trophy2 UCP entries use big-endian offsets, unlike the enclosing FIH. */
export async function ps5Trophies(
  _reader: ByteReader,
  pkg: Ps5Package,
  preferred = 'default',
): Promise<Resource<TrophySet>> {
  const result = await pkg.get(0x1480, 32 * 1024 * 1024)
  if (result.status !== 'ready') return result
  const bytes = result.data
  const invalid = () => new LibraryError('invalid_trophies', 'PS5 UCP 奖杯包损坏或格式不支持')
  if (
    bytes.length < 96 ||
    bytes.readUInt32BE(0) !== 0xb228c60a ||
    bytes.readUInt32BE(4) !== 1 ||
    safeU64(bytes, 8) !== bytes.length
  )
    throw invalid()
  const count = bytes.readUInt32BE(16),
    stride = bytes.readUInt32BE(20)
  if (count > 10000 || stride < 48 || stride > 4096 || 96 + count * stride > bytes.length) throw invalid()
  const files = new Map<string, Buffer>()
  let previousEnd = 96 + count * stride
  for (let i = 0; i < count; i++) {
    const p = 96 + i * stride,
      name = bytes.toString('utf8', p, p + 32).replace(/\0.*$/, '')
    const offset = safeU64(bytes, p + 32),
      size = safeU64(bytes, p + 40)
    if (!name || files.has(name) || offset < previousEnd || offset + size > bytes.length) throw invalid()
    files.set(name, bytes.subarray(offset, offset + size))
    previousEnd = offset + size
  }
  const json = (name: string) => {
    const data = files.get(name)
    if (!data || data.length > 2 * 1024 * 1024) throw invalid()
    return ps5Json(data)
  }
  const config = json('tropconf.json')
  const languages = [...files.keys()].flatMap((name) => /^tropmeta_(.+)\.json$/.exec(name)?.slice(1) || [])
  const language = [
    preferred === 'default' ? 'zh-Hans' : preferred,
    config.defaultLanguage,
    'en-US',
    ...languages,
  ].find((value) => typeof value === 'string' && languages.includes(value))
  if (!language || !Array.isArray(config.trophies) || config.trophies.length > 10000) throw invalid()
  const metadata = json(`tropmeta_${language}.json`)
  if (
    metadata.trophyNpCommId !== config.trophyNpCommId ||
    metadata.trophySetVersion !== config.trophySetVersion ||
    metadata.trophyDefinitionRevision !== config.trophyDefinitionRevision ||
    !Array.isArray(metadata.metadata?.trophyMetadata)
  )
    throw invalid()
  const localized = new Map<string, { name?: string; detail?: string }>(
    metadata.metadata.trophyMetadata.map((t: any) => [String(t.id), t]),
  )
  const ids = new Set<number>()
  const trophies: Trophy[] = config.trophies.map((t: any) => {
    const id = Number(t.id)
    if (!/^\d{1,6}$/.test(String(t.id)) || ids.has(id)) throw invalid()
    ids.add(id)
    const description = localized.get(String(t.id))
    const icon = files.get(`trop${t.id}.png`)
    return {
      id,
      name: typeof description?.name === 'string' ? description.name : '',
      description: typeof description?.detail === 'string' ? description.detail : '',
      grade: ({ P: '白金', G: '金', S: '银', B: '铜' } as Record<string, string>)[t.grade] || 'unknown',
      hidden: t.hidden === true,
      group: '全部奖杯',
      icon: icon && isPng(icon) ? `data:image/png;base64,${icon.toString('base64')}` : undefined,
    }
  })
  const storedHash = Buffer.from(bytes.subarray(0x1c, 0x30))
  // UCP SHA-1 is computed with its own hash field zeroed.
  bytes.fill(0, 0x1c, 0x30)
  const valid = Buffer.from(sha1(bytes)).equals(storedHash)
  return {
    status: 'ready',
    data: {
      trophies,
      language,
      availableLanguages: languages.map((id) => ({ id, label: id })),
      npCommunicationId: config.trophyNpCommId,
      metadataName: metadata.metadata?.titleMetadata?.name,
      warning: valid ? undefined : 'PS5 奖杯包 SHA-1 校验不匹配，内容可能已被修改',
    },
  }
}
