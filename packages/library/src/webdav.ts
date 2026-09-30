import { createClient, type WebDAVClient } from 'webdav/web'
import { Buffer } from 'buffer'
import { boundedSignal } from './abort'
import { LibraryError, type ByteReader, type SourceAdapter, type SourceConfig, type SourceEntry } from './types'

export class WebDAVSource implements SourceAdapter {
  private client: WebDAVClient
  constructor(
    public config: SourceConfig,
    private fetcher: typeof fetch = (input, init) => globalThis.fetch(input, init),
  ) {
    if (!config.url || !['http:', 'https:'].includes(new URL(config.url).protocol))
      throw new LibraryError('invalid_source', 'WebDAV HTTP address required')
    this.client = createClient(config.url, {
      username: config.username,
      password: config.password,
      headers: config.headers,
    })
  }
  private normalize(entry: any): SourceEntry {
    return { path: entry.filename, name: entry.basename, size: entry.size, modified: entry.lastmod, etag: entry.etag }
  }
  async *entries(signal?: AbortSignal) {
    const pending = [this.config.root || '/']
    while (pending.length) {
      signal?.throwIfAborted?.()
      const bounded = boundedSignal(signal)
      let entries: any[]
      try {
        entries = (await this.client.getDirectoryContents(pending.shift()!, { signal: bounded.signal })) as any[]
      } finally {
        bounded.dispose()
      }
      for (const entry of entries) {
        if (entry.type === 'directory') pending.push(entry.filename)
        else if (/\.(pkg|nsp|xci|cia|3ds)$/i.test(entry.basename)) yield this.normalize(entry)
      }
    }
  }
  async stat(path: string) {
    const bounded = boundedSignal()
    try {
      return this.normalize(await this.client.stat(path, { signal: bounded.signal }))
    } finally {
      bounded.dispose()
    }
  }
  private link(path: string) {
    const address = new URL(this.client.getFileDownloadLink(path))
    address.username = ''
    address.password = ''
    return address.href
  }
  async open(path: string): Promise<ByteReader> {
    const address = this.link(path)
    const headers = {
      ...this.config.headers,
      ...(this.config.username
        ? {
            Authorization: `Basic ${Buffer.from(`${this.config.username}:${this.config.password || ''}`).toString('base64')}`,
          }
        : {}),
    }
    return {
      readRange: async (offset, length, signal) => {
        if (
          !Number.isSafeInteger(offset) ||
          offset < 0 ||
          !Number.isSafeInteger(length) ||
          length < 0 ||
          length > 32 * 1024 * 1024
        )
          throw new LibraryError('invalid_range', 'Invalid byte range')
        if (!length) return new Uint8Array()
        const bounded = boundedSignal(signal)
        try {
          const end = offset + length - 1
          if (!Number.isSafeInteger(end)) throw new LibraryError('invalid_range', 'Invalid byte range')
          const response = await this.fetcher(address, {
            headers: { ...headers, Range: `bytes=${offset}-${end}` },
            signal: bounded.signal,
          })
          const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range') || '')
          if (
            response.status !== 206 ||
            !range ||
            Number(range[1]) !== offset ||
            Number(range[2]) !== end ||
            !Number.isSafeInteger(Number(range[3])) ||
            Number(range[3]) <= end
          ) {
            await response.body?.cancel()
            throw new LibraryError(
              response.status === 401 || response.status === 403 ? 'source_auth' : 'range_required',
              'Source must authorize and honor Range requests',
              502,
            )
          }
          const chunks: Uint8Array[] = []
          let received = 0
          const stream = response.body?.getReader()
          if (!stream) throw new LibraryError('source_empty', 'Source returned no bytes', 502)
          try {
            while (true) {
              const chunk = await stream.read()
              if (chunk.done) break
              received += chunk.value.length
              if (received > length) throw new LibraryError('invalid_range', 'Source exceeded requested range', 502)
              chunks.push(chunk.value)
            }
          } finally {
            await stream.cancel().catch(() => {})
          }
          if (received !== length) throw new LibraryError('short_read', 'Source returned an incomplete range', 502)
          const bytes = new Uint8Array(length)
          let cursor = 0
          for (const chunk of chunks) {
            bytes.set(chunk, cursor)
            cursor += chunk.length
          }
          return bytes
        } finally {
          bounded.dispose()
        }
      },
    }
  }
  async download(path: string) {
    if (this.config.username || this.config.password || Object.keys(this.config.headers || {}).length) return undefined
    return this.link(path)
  }
}
