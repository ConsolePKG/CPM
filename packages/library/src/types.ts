export type Platform = 'ps4' | 'ps5' | 'switch' | '3ds' | 'unknown'
export type ResourceKind = 'base' | 'patch' | 'dlc' | 'unknown'
export type ParseState = 'pending' | 'parsing' | 'ready' | 'partial' | 'unsupported' | 'failed'
export type SourceConfig = {
  id: string
  name: string
  type: 'folder' | 'webdav' | 'browser-files' | 'legacy-http'
  root?: string
  url?: string
  username?: string
  password?: string
  headers?: Record<string, string>
}
export type Library = { id: string; name: string; sources: SourceConfig[]; createdAt: string }
export type SourceEntry = {
  path: string
  name: string
  size: number
  modified?: string
  etag?: string
  version?: string
}
export type PackageMetadata = {
  platform: Platform
  format: string
  kind: ResourceKind
  title?: string
  titleId?: string
  contentId?: string
  version?: string
  compatibilityKey?: string
  raw: Record<string, unknown>
}
export type ParseResult = {
  state: 'ready' | 'partial' | 'unsupported'
  metadata: PackageMetadata
  cover?: Uint8Array
  message?: string
}
export type ResourceFile = SourceEntry & {
  id: string
  libraryId: string
  sourceId: string
  available: boolean
  fileVersion: string
  parserVersion: string
  state: ParseState
  metadata?: PackageMetadata
  coverId?: string
  message?: string
  revision: number
}
export type GameEntry = {
  id: string
  libraryId: string
  platform: Platform
  title: string
  titleId?: string
  base: string[]
  patches: string[]
  dlcs: string[]
  unknown: string[]
}
export type Scan = {
  id: string
  libraryId: string
  state: 'running' | 'completed' | 'failed'
  discovered: number
  parsed: number
  errors: string[]
}
export type Page<T> = { items: T[]; nextCursor?: string; revision: number }
export type ListQuery = { cursor?: string; limit?: number; search?: string; sourceId?: string }
export type Asset = { bytes: Uint8Array; contentType: string }
export type Download = { url?: string; expiresAt?: string; fileVersion: string; unavailable?: string }
export type ChangeSet = { revision: number; reset: boolean; files: ResourceFile[] }
export type LibraryCapabilities = {
  protocolVersion: 1
  writable: boolean
  persistence: 'session' | 'indexeddb' | 'sqlite'
  publishing: boolean
}
export interface ByteReader {
  readRange(offset: number, length: number, signal?: AbortSignal): Promise<Uint8Array>
  close?(): void | Promise<void>
}
export interface SourceAdapter {
  config: SourceConfig
  entries(signal?: AbortSignal): AsyncIterable<SourceEntry>
  stat(path: string): Promise<SourceEntry>
  open(path: string): Promise<ByteReader>
  download?(path: string): Promise<string | undefined>
}
export interface PackageParser {
  version: string
  parse(reader: ByteReader, signal?: AbortSignal): Promise<ParseResult>
  asset?(reader: ByteReader, kind: string, key?: string): Promise<Asset | unknown>
}
export type Snapshot = { libraries: Library[]; files: ResourceFile[]; scans: Scan[]; revision: number }
export interface LibraryStore {
  persistence: LibraryCapabilities['persistence']
  load(): Promise<Snapshot>
  library(value: Library): Promise<void>
  files(values: ResourceFile[], revision: number): Promise<void>
  scan(value: Scan): Promise<void>
  asset(id: string, value?: Asset): Promise<Asset | undefined>
  pruneAssets?(ids: string[]): Promise<void>
  close?(): void | Promise<void>
}
export interface LibraryClient {
  capabilities(): Promise<LibraryCapabilities>
  listLibraries(): Promise<Library[]>
  createLibrary(name: string, sources?: SourceConfig[]): Promise<Library>
  addSource(libraryId: string, source: SourceConfig): Promise<Library>
  updateSource(libraryId: string, source: SourceConfig): Promise<Library>
  removeSource(libraryId: string, sourceId: string): Promise<void>
  listFiles(libraryId: string, query?: ListQuery): Promise<Page<ResourceFile>>
  getFile(fileId: string): Promise<ResourceFile>
  listGames(libraryId: string, query?: ListQuery): Promise<Page<GameEntry>>
  getGame(libraryId: string, gameId: string): Promise<GameEntry>
  scan(libraryId: string): Promise<Scan>
  getScan(scanId: string): Promise<Scan>
  retry(fileId: string): Promise<void>
  changes(libraryId: string, after: number): Promise<ChangeSet>
  asset(assetId: string): Promise<Asset>
  resource(fileId: string, kind: string, key?: string): Promise<unknown>
  download(fileId: string): Promise<Download>
}
export class LibraryError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message)
  }
}
export function newId(prefix: string) {
  const bytes = new Uint8Array(16)
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes)
  else for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256)
  return `${prefix}_${Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')}`
}
export function fileVersion(entry: SourceEntry) {
  return JSON.stringify([entry.size, entry.etag || '', entry.modified || '', entry.version || ''])
}
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}
export function pageable<T>(items: T[], query: ListQuery = {}, revision = 0): Page<T> {
  const offset = query.cursor ? Number(query.cursor) : 0
  const limit = query.limit ?? 50
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 200)
    throw new LibraryError('invalid_page', 'Invalid cursor or limit')
  return {
    items: items.slice(offset, offset + limit),
    nextCursor: offset + limit < items.length ? String(offset + limit) : undefined,
    revision,
  }
}
