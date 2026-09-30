import { Buffer } from 'buffer'
import { extract } from '@njzy/ps4-pkg-info/core'
import { extractArtwork, extractArtworkImage, extractTrophies } from '@njzy/ps4-pkg-info/resources'
import { LibraryError, type ByteReader, type PackageParser } from './types'

export function seekReader(reader: ByteReader, signal?: AbortSignal) {
  return {
    seekChunk: async (offset: number, end = offset + 65535) => {
      if (
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        !Number.isSafeInteger(end) ||
        end < offset ||
        end - offset + 1 > 32 * 1024 * 1024
      )
        throw new LibraryError('invalid_range', 'Resource range exceeds limit')
      return Buffer.from(await reader.readRange(offset, end - offset + 1, signal))
    },
  }
}
export const packageParser: PackageParser = {
  version: 'consolepkg-1',
  async parse(reader, signal) {
    const header = await reader.readRange(0, 4, signal)
    if (header.length !== 4 || ![127, 67, 78, 84].every((value, index) => header[index] === value))
      return {
        state: 'unsupported',
        metadata: { platform: 'unknown', format: 'unknown', kind: 'unknown', raw: {} },
        message: 'Unverified package format; no metadata inferred from its name',
      }
    const result = await extract(seekReader(reader, signal))
    const raw = (result?.paramSfo as unknown as Record<string, unknown>) || {}
    const text = (name: string) => (typeof raw[name] === 'string' ? (raw[name] as string) : undefined)
    const category = text('CATEGORY')
    const kind = ['gd', 'gdn'].includes(category || '')
      ? 'base'
      : ['gp', 'gpn'].includes(category || '')
        ? 'patch'
        : category === 'ac'
          ? 'dlc'
          : 'unknown'
    return {
      state: text('TITLE_ID') && text('CONTENT_ID') ? 'ready' : 'partial',
      metadata: {
        platform: 'ps4',
        format: 'ps4-pkg',
        kind,
        title: text('TITLE'),
        titleId: text('TITLE_ID'),
        contentId: text('CONTENT_ID'),
        version: text('APP_VER'),
        raw,
      },
      cover: result?.icon0Raw ? Uint8Array.from(result.icon0Raw) : undefined,
    }
  },
  async asset(reader, kind, key) {
    const source = seekReader(reader)
    if (kind === 'artwork') return extractArtwork(source)
    if (kind === 'trophies') return extractTrophies(source, key)
    if (kind === 'artwork-image') return extractArtworkImage(source, Number(key))
    throw new LibraryError('unsupported_asset', 'Unsupported resource kind')
  },
}
