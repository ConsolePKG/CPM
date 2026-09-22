import { Buffer } from 'buffer'
import { cbc } from '@noble/ciphers/aes.js'
import { XMLParser, XMLValidator } from 'fast-xml-parser'

export type Trophy = {
  id: number
  name: string
  description: string
  grade: string
  hidden: boolean
  group: string
  icon?: string
}
export type TrophyLanguage = { id: string; label: string }
export type TrophySet = {
  availableLanguages?: TrophyLanguage[]
  language?: string
  trophies: Trophy[]
  npCommunicationId?: string
  metadataName?: string
  warning?: string
}
type TrpEntry = { name: string; bytes: Buffer; flags: number }
export function readTrp(bytes: Buffer): TrpEntry[] {
  if (bytes.length < 64 || bytes.readUInt32BE(0) !== 0xdca24d00) throw new Error('无效的 TRP 奖杯文件')
  const version = bytes.readUInt32BE(4)
  const start = version === 3 ? 96 : 64
  const count = bytes.readUInt32BE(16),
    stride = bytes.readUInt32BE(20)
  if (
    version < 1 ||
    version > 3 ||
    bytes.readUInt32BE(8) !== 0 ||
    bytes.readUInt32BE(12) !== bytes.length ||
    count > 10000 ||
    stride < 64 ||
    stride > 4096 ||
    start + count * stride > bytes.length
  )
    throw new Error('TRP 头部或条目表损坏')
  const names = new Set<string>()
  return Array.from({ length: count }, (_, i) => {
    const p = start + i * stride
    const name = bytes
      .subarray(p, p + 32)
      .toString('utf8')
      .split('\0')[0]
      .toUpperCase()
    const offset = bytes.readUInt32BE(p + 36),
      size = bytes.readUInt32BE(p + 44)
    if (
      bytes.readUInt32BE(p + 32) ||
      bytes.readUInt32BE(p + 40) ||
      offset < start + count * stride ||
      offset + size > bytes.length ||
      names.has(name)
    )
      throw new Error('TRP 资源越界或重名')
    names.add(name)
    return { name, bytes: bytes.subarray(offset, offset + size), flags: bytes.readUInt32BE(p + 48) }
  })
}

export function decryptEsfm(bytes: Buffer, npwr: string): Buffer {
  if (!/^NPWR\d{5}_\d{2}$/.test(npwr) || bytes.length < 32 || bytes.length % 16)
    throw new Error('ESFM 数据或 NPWR 标识无效')
  // PS4 trophy format: title key = AES-CBC(master, zero IV, padded NPWR), no padding.
  const master = Buffer.from('21f41a6bad8a1d3eca7ad586c101b7a9', 'hex')
  const input = Buffer.alloc(16)
  input.write(npwr, 'ascii')
  const key = cbc(master, new Uint8Array(16), { disablePadding: true }).encrypt(input)
  try {
    const plain = Buffer.from(cbc(key, new Uint8Array(16)).decrypt(bytes))
    if (plain.length < 17 || plain.subarray(0, 16).some((byte) => byte !== 0)) throw new Error('prefix')
    return plain.subarray(16)
  } catch {
    throw new Error('奖杯元数据解密失败：NPWR 不匹配或数据损坏')
  }
}

export function parseTrophyXml(bytes: Buffer, expectedId?: string): TrophySet {
  if (bytes.length > 2 * 1024 * 1024) throw new Error('奖杯 XML 超出大小限制')
  const xml = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('奖杯 XML 格式无效')
  const doc = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
    htmlEntities: true,
    isArray: (name) => name === 'trophy' || name === 'group',
  }).parse(xml)
  const root = doc.trophyconf
  if (!root || typeof root !== 'object') throw new Error('缺少 trophyconf 元数据')
  const npwr = typeof root.npcommid === 'string' ? root.npcommid.trim() : undefined
  if (expectedId && expectedId !== npwr) throw new Error('奖杯 XML 的 NPWR 标识不匹配')
  const text = (value: unknown): string => (typeof value === 'string' ? value : '')
  const id = (value: unknown): number => {
    if (typeof value !== 'string' || !/^\d{1,6}$/.test(value)) throw new Error('奖杯编号无效')
    return Number(value)
  }
  const groups = new Map<number, string>(
    (root.group || []).map((group: Record<string, unknown>) => [id(group['@_id']), text(group.name)]),
  )
  const seen = new Set<number>()
  const trophies: Trophy[] = (root.trophy || []).map((t: Record<string, unknown>) => {
    const trophyId = id(t['@_id'])
    if (seen.has(trophyId)) throw new Error('奖杯编号重复')
    seen.add(trophyId)
    const hidden = text(t['@_hidden'] || 'no').toLowerCase()
    if (!['yes', 'no'].includes(hidden)) throw new Error('奖杯隐藏标记无效')
    const groupId = t['@_gid'] === undefined || t['@_gid'] === '-1' ? 0 : id(t['@_gid'])
    const grade = text(t['@_ttype']).toUpperCase()
    return {
      id: trophyId,
      name: text(t.name),
      description: text(t.detail),
      grade: ({ B: '铜', S: '银', G: '金', P: '白金' } as Record<string, string>)[grade] || '未知',
      hidden: hidden === 'yes',
      group: groupId ? groups.get(groupId) || `分组 ${groupId}` : '本体',
    }
  })
  if (!trophies.length) throw new Error('元数据未包含奖杯定义')
  return { trophies: trophies.sort((a, b) => a.id - b.id), npCommunicationId: npwr }
}

// OpenOrbis include/orbis/_types/sys_service.h: OrbisSystemParamLanguage.
const languageNames: Record<string, string> = {
  '00': '日语',
  '01': '英语（美国）',
  '02': '法语',
  '03': '西班牙语',
  '04': '德语',
  '05': '意大利语',
  '06': '荷兰语',
  '07': '葡萄牙语',
  '08': '俄语',
  '09': '韩语',
  '10': '繁体中文',
  '11': '简体中文',
  '12': '芬兰语',
  '13': '瑞典语',
  '14': '丹麦语',
  '15': '挪威语',
  '16': '波兰语',
  '17': '葡萄牙语（巴西）',
  '18': '英语（英国）',
  '19': '土耳其语',
  '20': '西班牙语（拉丁美洲）',
  '21': '阿拉伯语',
  '22': '法语（加拿大）',
  '23': '捷克语',
  '24': '匈牙利语',
  '25': '希腊语',
  '26': '罗马尼亚语',
  '27': '泰语',
  '28': '越南语',
  '29': '印度尼西亚语',
}
const entryLanguage = (name: string) => /^(?:TROP|TROPCONF)_(\d{2})\.(?:ESFM|SFM|XML)$/.exec(name)?.[1] || 'default'

export function parseTrophies(bytes: Buffer, npwr?: string | string[], language = 'default'): TrophySet {
  if (language !== 'default' && !/^\d{2}$/.test(language)) throw new Error('无效的奖杯语言编号')
  const ids = [...new Set(typeof npwr === 'string' ? [npwr] : npwr || [])].filter((id) => /^NPWR\d{5}_\d{2}$/.test(id))
  const entries = readTrp(bytes)
  const icons = new Map<number, string>()
  for (const entry of entries) {
    const match = /^TROP(\d{3})\.PNG$/.exec(entry.name)
    if (match && entry.bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')))
      icons.set(Number(match[1]), `data:image/png;base64,${entry.bytes.toString('base64')}`)
  }
  const metadata = entries.filter((entry) => /\.(ESFM|SFM|XML)$/.test(entry.name))
  const availableLanguages = [...new Set(metadata.map((entry) => entryLanguage(entry.name)))]
    .sort()
    .map((id) => ({ id, label: id === 'default' ? '默认语言' : languageNames[id] || `语言 ${id}` }))
  const candidates = metadata.filter((entry) => entryLanguage(entry.name) === language)
  const preferred = ['TROP.ESFM', 'TROP.SFM', 'TROPCONF.ESFM', 'TROPCONF.SFM', 'TROPCONF.XML']
  candidates.sort((a, b) => {
    const rank = (name: string) => (preferred.includes(name) ? preferred.indexOf(name) : preferred.length)
    return rank(a.name) - rank(b.name) || a.name.localeCompare(b.name)
  })
  let warning = language === 'default' ? '未找到默认奖杯文案，请选择包内的其他语言' : '此 PKG 未包含所选语言的奖杯文案'
  for (const entry of candidates) {
    try {
      if (entry.bytes.length > 2 * 1024 * 1024) throw new Error('奖杯元数据超出大小限制')
      let result: TrophySet
      if (entry.bytes.toString('utf8', 0, Math.min(entry.bytes.length, 100)).trimStart().startsWith('<')) {
        result = parseTrophyXml(entry.bytes)
        if (ids.length && result.npCommunicationId && !ids.includes(result.npCommunicationId))
          throw new Error('奖杯 XML 的 NPWR 标识与绑定文件不匹配')
      } else {
        if (!entry.name.endsWith('.ESFM') || entry.flags !== 3) throw new Error('奖杯元数据格式暂不支持')
        if (!ids.length) throw new Error('未能从绑定文件读取 NPWR，无法解密奖杯信息')
        if (ids.length > 16) throw new Error('NPWR 候选数量过多，暂不支持此绑定文件')
        const matches: TrophySet[] = []
        for (const id of ids) {
          try {
            matches.push(parseTrophyXml(decryptEsfm(entry.bytes, id), id))
          } catch {
            /* Try the next bound ID. */
          }
        }
        if (matches.length !== 1)
          throw new Error(
            matches.length ? '多个 NPWR 均通过校验，无法确定奖杯归属' : '所有绑定 NPWR 均未通过解密及 XML 校验',
          )
        result = matches[0]
      }
      return {
        ...result,
        metadataName: entry.name,
        availableLanguages,
        language,
        trophies: result.trophies.map((t) => ({ ...t, icon: icons.get(t.id) })),
      }
    } catch (error) {
      warning = (error as Error).message
    }
  }
  // Icons remain useful even if names/descriptions cannot be decrypted.
  return {
    npCommunicationId: ids.length === 1 ? ids[0] : undefined,
    warning,
    availableLanguages,
    language,
    trophies: [...icons]
      .sort(([a], [b]) => a - b)
      .map(([id, icon]) => ({
        id,
        icon,
        name: `奖杯 ${id}`,
        description: '',
        grade: '未知',
        hidden: false,
        group: '未知',
      })),
  }
}
