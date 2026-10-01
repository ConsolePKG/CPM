import { LibraryError, type LibraryClient, type ListQuery, type SourceConfig } from './types'

export class RemoteLibraryClient implements LibraryClient {
  readonly baseUrl: string
  readonly token: string
  constructor(
    address: string,
    token = '',
    private fetcher: typeof fetch = (input, init) => globalThis.fetch(input, init),
  ) {
    const parsed = new URL(address)
    if (!['http:', 'https:'].includes(parsed.protocol))
      throw new LibraryError('invalid_url', 'HTTP library address required')
    this.token = token || new URLSearchParams(parsed.hash.slice(1)).get('token') || ''
    parsed.hash = ''
    parsed.search = ''
    this.baseUrl = parsed.href.replace(/\/$/, '')
  }
  private async request(path: string, body?: unknown) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30000)
    try {
      const response = await this.fetcher(`${this.baseUrl}/api/v1${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new LibraryError(error.code || 'http_error', error.message || `HTTP ${response.status}`, response.status)
      }
      if (response.headers.get('content-type')?.startsWith('application/json')) return await response.json()
      return {
        bytes: new Uint8Array(await response.arrayBuffer()),
        contentType: response.headers.get('content-type') || 'application/octet-stream',
      }
    } catch (error) {
      if (error instanceof LibraryError) throw error
      throw new LibraryError(
        controller.signal.aborted ? 'timeout' : 'network_error',
        controller.signal.aborted ? '资源库请求超时，请检查资源库服务' : '无法读取资源库响应，请检查资源库连接和服务',
      )
    } finally {
      clearTimeout(timer)
    }
  }
  private query(query: ListQuery) {
    return new URLSearchParams(
      Object.entries(query)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, String(value)]),
    ).toString()
  }
  capabilities() {
    return this.request('/capabilities')
  }
  listLibraries() {
    return this.request('/libraries')
  }
  createLibrary(name: string, sources: SourceConfig[] = []) {
    return this.request('/libraries', { name, sources })
  }
  addSource(libraryId: string, source: SourceConfig) {
    return this.request(`/libraries/${encodeURIComponent(libraryId)}/sources`, source)
  }
  updateSource(libraryId: string, source: SourceConfig) {
    return this.request(`/libraries/${encodeURIComponent(libraryId)}/sources/${encodeURIComponent(source.id)}`, source)
  }
  async removeSource(libraryId: string, sourceId: string) {
    await this.request(`/libraries/${encodeURIComponent(libraryId)}/sources/${encodeURIComponent(sourceId)}/remove`, {})
  }
  listFiles(libraryId: string, query: ListQuery = {}) {
    return this.request(`/libraries/${encodeURIComponent(libraryId)}/files?${this.query(query)}`)
  }
  listGames(libraryId: string, query: ListQuery = {}) {
    return this.request(`/libraries/${encodeURIComponent(libraryId)}/games?${this.query(query)}`)
  }
  getGame(libraryId: string, gameId: string) {
    return this.request(`/libraries/${encodeURIComponent(libraryId)}/games/${encodeURIComponent(gameId)}`)
  }
  getFile(fileId: string) {
    return this.request(`/files/${encodeURIComponent(fileId)}`)
  }
  scan(libraryId: string) {
    return this.request(`/libraries/${encodeURIComponent(libraryId)}/scans`, {})
  }
  getScan(scanId: string) {
    return this.request(`/scans/${encodeURIComponent(scanId)}`)
  }
  async retry(fileId: string) {
    await this.request(`/files/${encodeURIComponent(fileId)}/retry`, {})
  }
  changes(libraryId: string, after: number) {
    return this.request(`/libraries/${encodeURIComponent(libraryId)}/changes?after=${after}`)
  }
  asset(assetId: string) {
    return this.request(`/assets/${encodeURIComponent(assetId)}`)
  }
  resource(fileId: string, kind: string, key?: string) {
    return this.request(
      `/files/${encodeURIComponent(fileId)}/resources/${encodeURIComponent(kind)}${key ? `?key=${encodeURIComponent(key)}` : ''}`,
    )
  }
  download(fileId: string) {
    return this.request(`/files/${encodeURIComponent(fileId)}/download`, {})
  }
  createShare(libraryId: string) {
    return this.request(`/libraries/${encodeURIComponent(libraryId)}/shares`, {})
  }
  listShares(libraryId: string) {
    return this.request(`/libraries/${encodeURIComponent(libraryId)}/shares`)
  }
  async revokeShare(shareId: string) {
    await this.request(`/shares/${encodeURIComponent(shareId)}/revoke`, {})
  }
}
