import type { FileStat } from '@/types'

/** PS5 firmware is a 64-bit hex string; never round it through Number. */
export function formatPs5SystemVersion(value: unknown): string {
  if (typeof value !== 'string' || !value) return '—'
  const hex = /^(?:0x)?(\d{4})[\da-f]{12}$/i.exec(value)
  return hex ? `${Number(hex[1].slice(0, 2))}.${hex[1].slice(2)}` : value
}
export function pkgInfo(file?: FileStat) {
  const metadata = file?.resourceMetadata
  const sfo = file?.paramSfo
  const ps5 = file?.resourcePlatform === 'ps5' || metadata?.platform === 'ps5'
  const kind = metadata?.kind || file?.resourceKind
  return {
    ps5,
    platform: ps5
      ? 'PS5'
      : file?.resourcePlatform && file.resourcePlatform !== 'ps4'
        ? file.resourcePlatform.toUpperCase()
        : sfo
          ? 'PS4'
          : '—',
    title: metadata?.title || sfo?.TITLE,
    titleId: metadata?.titleId || sfo?.TITLE_ID,
    contentId: metadata?.contentId || sfo?.CONTENT_ID,
    version: metadata?.version || sfo?.APP_VER,
    masterVersion: metadata?.masterVersion || sfo?.VERSION,
    category:
      kind && kind !== 'unknown'
        ? { base: '游戏本体', patch: '游戏补丁', dlc: '追加内容（DLC）' }[kind]
        : formatPkgCategory(sfo?.CATEGORY),
    isDlc: kind === 'dlc' || sfo?.CATEGORY === 'ac',
    systemVersion: ps5
      ? formatPs5SystemVersion(metadata?.requiredSystemVersion || metadata?.raw.requiredSystemSoftwareVersion)
      : formatSystemVersion(sfo?.SYSTEM_VER),
    raw: metadata?.raw || sfo || {},
  }
}

/** SYSTEM_VER stores decimal digits in the high two bytes, e.g. 0x09000000. */
export function formatSystemVersion(value: string | number | undefined): string {
  if (value === undefined || value === '') return '—'
  const raw = typeof value === 'number' ? value : /^(?:0x[\da-f]+|\d+)$/i.test(value) ? Number(value) : NaN
  if (!Number.isInteger(raw) || raw < 0 || raw > 0xffffffff) return String(value)
  const digits = raw.toString(16).padStart(8, '0').slice(0, 4)
  // Preserve unfamiliar encodings instead of showing a misleading firmware version.
  if (!/^\d{4}$/.test(digits)) return String(value)
  return `${Number(digits.slice(0, 2))}.${digits.slice(2)}`
}

const categories: Record<string, string> = {
  gd: '游戏本体',
  gdn: '游戏本体',
  gp: '游戏补丁',
  gpn: '游戏补丁',
  ac: '追加内容（DLC）',
  bd: '蓝光光盘',
  gc: '游戏内容',
  gda: '系统应用',
  gdc: '大型应用',
  gdd: '后台应用',
  gde: '迷你应用',
  gdk: '视频服务应用',
  gdl: '云游戏应用',
  gdO: 'PS2 游戏',
  gpc: '大型应用补丁',
  gpd: '后台应用补丁',
  gpe: '迷你应用补丁',
  gpk: '视频服务应用补丁',
  gpl: '云游戏应用补丁',
  sd: '存档数据',
}
export function formatPkgCategory(value: string | undefined): string {
  return value ? categories[value] || value : '—'
}
