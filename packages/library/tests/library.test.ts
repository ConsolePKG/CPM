import { describe, expect, it } from '@rstest/core'
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LibraryEngine } from '../src/core'
import { MemoryStore } from '../src/store'
import { packageParser } from '../src/parser'
import { BrowserFilesSource } from '../src/browser'
import { FolderSource } from '../src/node/folder'
import type { SourceConfig, SourceEntry, SourceAdapter } from '../src/types'
import { WebDAVSource } from '../src/webdav'
import { packageFixture } from './fixtures'

describe('portable library', () => {
  it('skips sidecar resources from every adapter and omits previously indexed metadata', async () => {
    const store = new MemoryStore()
    const engine = await new LibraryEngine(
      store,
      {
        version: 'test',
        parse: async () => ({
          state: 'unsupported',
          metadata: { platform: 'unknown', format: 'unknown', kind: 'unknown', raw: {} },
        }),
      },
      (config) => ({
        config,
        entries: async function* () {
          for (const path of ['._hello_world', '._game.pkg', '__MACOSX/game.pkg', '@eaDir/game.pkg', 'game.pkg'])
            yield { path, name: path, size: 4, version: '1' }
        },
        stat: async (path) => ({ path, name: path, size: 4, version: '1' }),
        open: async () => ({ readRange: async () => new Uint8Array(4) }),
      }),
    ).initialize()
    try {
      const library = await engine.createLibrary('Library', [{ id: 'source', type: 'folder', name: 'Source' }])
      await engine.scan(library.id)
      await engine.idle()
      const resources = (await engine.listFiles(library.id)).items
      expect(resources.map((file) => file.path)).toEqual(['game.pkg'])
      await store.files([{ ...resources[0], id: 'old-sidecar', path: '._old.pkg', name: '._old.pkg' }], 100)
      const reopened = await new LibraryEngine(store, packageParser, (config) => ({
        config,
        entries: async function* () {},
        stat: async (path) => ({ path, name: path, size: 4 }),
        open: async () => ({ readRange: async () => new Uint8Array(4) }),
      })).initialize()
      try {
        expect((await reopened.listFiles(library.id)).items).toHaveLength(1)
        expect((await reopened.listGames(library.id)).items).toHaveLength(1)
      } finally {
        await reopened.close()
      }
    } finally {
      await engine.close()
    }
  })
  it('bounds parsing across libraries and publishes discovered files before all parsing completes', async () => {
    let active = 0,
      peak = 0
    let release!: () => void, entered!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    const store = new MemoryStore()
    const engine = await new LibraryEngine(
      store,
      {
        version: 'test',
        parse: async () => {
          active++
          peak = Math.max(peak, active)
          if (active === 2) entered()
          await gate
          active--
          return {
            state: 'unsupported',
            metadata: { platform: 'unknown', format: 'unknown', kind: 'unknown', raw: {} },
          }
        },
      },
      (config) => ({
        config,
        entries: async function* () {
          for (const name of ['one.pkg', 'two.pkg', 'three.pkg']) yield { path: name, name, size: 4, version: '1' }
        },
        stat: async (path) => ({ path, name: path, size: 4, version: '1' }),
        open: async () => ({ readRange: async () => new Uint8Array(4) }),
      }),
    ).initialize()
    const first = await engine.createLibrary('One', [{ id: 'one', type: 'folder', name: 'One' }])
    const second = await engine.createLibrary('Two', [{ id: 'two', type: 'folder', name: 'Two' }])
    try {
      await Promise.all([engine.scan(first.id), engine.scan(second.id)])
      await started
      const indexed = [...(await engine.listFiles(first.id)).items, ...(await engine.listFiles(second.id)).items]
      expect(indexed.length).toBeGreaterThan(0)
      expect(indexed.some((file) => ['pending', 'parsing'].includes(file.state))).toBe(true)
      release()
      await engine.idle()
      expect(peak).toBe(2)
      expect((await engine.listFiles(first.id)).items).toHaveLength(3)
      expect((await engine.listFiles(second.id)).items).toHaveLength(3)
    } finally {
      release()
      await engine.close()
    }
  })
  it('aborts in-flight parsing at shutdown and leaves it recoverable', async () => {
    let entered!: () => void
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    const store = new MemoryStore()
    const engine = await new LibraryEngine(
      store,
      {
        version: 'test',
        parse: async (_reader, signal) =>
          new Promise((_resolve, reject) => {
            signal!.addEventListener('abort', () => reject(new Error('stopped')), { once: true })
            entered()
          }),
      },
      (config) => ({
        config,
        entries: async function* () {
          yield { path: 'game.pkg', name: 'game.pkg', size: 4, version: '1' }
        },
        stat: async () => ({ path: 'game.pkg', name: 'game.pkg', size: 4, version: '1' }),
        open: async () => ({ readRange: async () => new Uint8Array(4) }),
      }),
    ).initialize()
    const library = await engine.createLibrary('One', [{ id: 'one', type: 'folder', name: 'One' }])
    await engine.scan(library.id)
    await started
    await engine.close()
    expect((await store.load()).files[0].state).toBe('pending')
  })
  it('parses the exact same bytes from browser File and rooted filesystem, with cover at EOF', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cpm-parser-'))
    try {
      const bytes = packageFixture()
      await writeFile(join(root, 'game.pkg'), bytes)
      const config: SourceConfig = { id: 'folder', name: 'folder', type: 'folder', root }
      const node = await new FolderSource(config).open('game.pkg')
      const browser = await new BrowserFilesSource(
        { ...config, type: 'browser-files' },
        new Map([['game.pkg', new File([bytes], 'game.pkg')]]),
      ).open('game.pkg')
      try {
        const result = await packageParser.parse(node)
        expect(result).toEqual(await packageParser.parse(browser))
        expect(result.state).toBe('ready')
        expect(result.metadata.kind).toBe('base')
        expect(result.cover?.length).toBeGreaterThan(8)
      } finally {
        await node.close?.()
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
  it('does not infer metadata for unsupported bytes from a convincing filename', async () => {
    const result = await packageParser.parse({ readRange: async () => new Uint8Array(4) })
    expect(result.state).toBe('unsupported')
    expect(result.metadata.title).toBeUndefined()
  })
  it('keeps duplicate copies and orphan DLC, isolates malformed files, caches only versioned files, and preserves files during outages', async () => {
    const config: SourceConfig = { id: 'source', name: 'Test', type: 'folder' }
    let offline = false
    let reads = 0
    const entries: SourceEntry[] = ['base.pkg', 'copy.pkg', 'patch.pkg', 'dlc.pkg', 'broken.pkg'].map((name) => ({
      path: name,
      name,
      size: 1000,
      version: '1',
    }))
    const source: SourceAdapter = {
      config,
      entries: async function* () {
        if (offline) throw new Error('offline')
        yield* entries
      },
      stat: async (path) => entries.find((entry) => entry.path === path)!,
      open: async (path) => ({
        readRange: async () => {
          reads++
          if (path === 'broken.pkg') throw new Error('bad')
          return packageFixture(
            path === 'patch.pkg' ? 'gp' : path === 'dlc.pkg' ? 'ac' : 'gd',
            path === 'dlc.pkg' ? 'CUSA54321' : 'CUSA12345',
          )
        },
      }),
    }
    const store = new MemoryStore()
    const engine = await new LibraryEngine(
      store,
      {
        ...packageParser,
        parse: async (reader) => {
          const bytes = await reader.readRange(0, 1)
          return packageParser.parse({ readRange: async (offset, length) => bytes.slice(offset, offset + length) })
        },
      },
      () => source,
    ).initialize()
    const library = await engine.createLibrary('Test', [config])
    await engine.scan(library.id)
    await engine.idle()
    const files = (await engine.listFiles(library.id)).items
    expect(files.filter((file) => file.state === 'ready')).toHaveLength(4)
    expect(files.find((file) => file.name === 'broken.pkg')?.state).toBe('failed')
    const games = (await engine.listGames(library.id)).items
    expect(games.find((game) => game.titleId === 'CUSA12345')?.base).toHaveLength(2)
    expect(games.find((game) => game.titleId === 'CUSA54321')?.dlcs).toHaveLength(1)
    const before = reads
    await engine.scan(library.id)
    await engine.idle()
    expect(reads - before).toBe(1)
    offline = true
    await engine.scan(library.id)
    await engine.idle()
    expect((await engine.listFiles(library.id)).items.every((file) => file.available)).toBe(true)
    offline = false
    entries.splice(0, 1)
    await engine.scan(library.id)
    await engine.idle()
    expect((await engine.listFiles(library.id)).items.filter((file) => !file.available)).toHaveLength(1)
    const resumed = await new LibraryEngine(store, packageParser, () => source).initialize()
    expect((await resumed.listFiles(library.id)).items).toHaveLength(5)
  })
  it('discards an old parse and requeues a changed file without a second scan', async () => {
    let version = '1'
    let calls = 0
    const config: SourceConfig = { id: 'changed', name: 'changed', type: 'folder' }
    const entry = () => ({ path: 'game.pkg', name: 'game.pkg', size: 100, version })
    const source: SourceAdapter = {
      config,
      entries: async function* () {
        yield entry()
      },
      stat: async () => entry(),
      open: async () => ({ readRange: async () => new Uint8Array(4) }),
    }
    const parser = {
      version: '1',
      parse: async () => {
        calls++
        version = '2'
        return {
          state: 'partial' as const,
          metadata: { platform: 'unknown' as const, format: 'test', kind: 'unknown' as const, raw: {} },
        }
      },
    }
    const engine = await new LibraryEngine(new MemoryStore(), parser, () => source).initialize()
    const library = await engine.createLibrary('changed', [config])
    await engine.scan(library.id)
    await engine.idle()
    expect(calls).toBe(2)
    expect((await engine.listFiles(library.id)).items[0].state).toBe('partial')
  })
  it('rejects an HTTP source that ignores Range before reading a full PKG', async () => {
    let cancelled = false
    const source = new WebDAVSource(
      { id: 'dav', type: 'webdav', name: 'dav', url: 'https://example.test' },
      async () =>
        new Response(
          new ReadableStream({
            cancel() {
              cancelled = true
            },
          }),
          { status: 200 },
        ),
    )
    const reader = await source.open('/game.pkg')
    await expect(reader.readRange(0, 4)).rejects.toThrow('Range')
    expect(cancelled).toBe(true)
  })
  it('does not escape a filesystem root through path traversal', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'cpm-root-'))
    await mkdir(join(parent, 'games'))
    await writeFile(join(parent, 'outside.pkg'), packageFixture())
    try {
      const source = new FolderSource({ id: 'source', name: 'source', type: 'folder', root: join(parent, 'games') })
      await expect(source.open('../outside.pkg')).rejects.toThrow('outside')
    } finally {
      await rm(parent, { recursive: true, force: true })
    }
  })
})
