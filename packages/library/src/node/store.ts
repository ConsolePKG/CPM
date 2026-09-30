import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Asset, Library, LibraryStore, ResourceFile, Scan } from '../types'

export class SQLiteStore implements LibraryStore {
  persistence = 'sqlite' as const
  readonly database: Database.Database
  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true })
    this.database = new Database(path)
    this.database.pragma('journal_mode = WAL')
    this.database.exec(
      'CREATE TABLE IF NOT EXISTS records (kind TEXT, id TEXT, value TEXT NOT NULL, PRIMARY KEY(kind,id)); CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, mime TEXT NOT NULL, bytes BLOB NOT NULL); CREATE TABLE IF NOT EXISTS grants (id TEXT PRIMARY KEY, digest TEXT UNIQUE NOT NULL, library TEXT NOT NULL, revoked INTEGER NOT NULL DEFAULT 0);',
    )
  }
  private records(kind: string) {
    return (this.database.prepare('SELECT value FROM records WHERE kind=?').all(kind) as { value: string }[]).map(
      (row) => JSON.parse(row.value),
    )
  }
  private put(kind: string, id: string, value: unknown) {
    this.database.prepare('INSERT OR REPLACE INTO records VALUES (?,?,?)').run(kind, id, JSON.stringify(value))
  }
  async load() {
    return {
      libraries: this.records('library'),
      files: this.records('file'),
      scans: this.records('scan'),
      revision: this.records('revision')[0] || 0,
    }
  }
  async library(value: Library) {
    this.put('library', value.id, value)
  }
  async scan(value: Scan) {
    this.put('scan', value.id, value)
  }
  async files(values: ResourceFile[], revision: number) {
    this.database.transaction(() => {
      for (const value of values) this.put('file', value.id, value)
      this.put('revision', 'revision', revision)
    })()
  }
  async asset(id: string, value?: Asset) {
    if (value) {
      this.database
        .prepare('INSERT OR REPLACE INTO assets VALUES (?,?,?)')
        .run(id, value.contentType, Buffer.from(value.bytes))
      return value
    }
    const row = this.database.prepare('SELECT mime,bytes FROM assets WHERE id=?').get(id) as
      | { mime: string; bytes: Buffer }
      | undefined
    return row ? { bytes: new Uint8Array(row.bytes), contentType: row.mime } : undefined
  }
  close() {
    this.database.close()
  }
  async pruneAssets(ids: string[]) {
    const retained = new Set(ids)
    this.database.transaction(() => {
      for (const row of this.database.prepare('SELECT id FROM assets').all() as { id: string }[])
        if (!retained.has(row.id)) this.database.prepare('DELETE FROM assets WHERE id=?').run(row.id)
    })()
  }
}
