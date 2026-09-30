import { describe, expect, it } from '@rstest/core'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createNodeLibrary, createLibraryServer } from '../src/node'
import { RemoteLibraryClient } from '../src/client'
import { packageFixture } from './fixtures'

describe('real library HTTP protocol and SQLite', () => {
  it('parses in an isolated Node process with both ESM and CommonJS TypeScript dependencies', async () => {
    const parser = new URL('../src/node/parser.ts', import.meta.url).href
    const bytes = packageFixture().toString('base64')
    const script = `
      import { nodeWorkerParser } from ${JSON.stringify(parser)};
      const bytes = Buffer.from(${JSON.stringify(bytes)}, 'base64');
      const result = await nodeWorkerParser().parse({ readRange: async (offset, length) => bytes.subarray(offset, offset + length) });
      console.log(JSON.stringify(result));
    `
    const result = await promisify(execFile)(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script])
    expect(JSON.parse(result.stdout).metadata.titleId).toBe('CUSA12345')
    expect(JSON.parse(result.stdout).state).toBe('ready')
  })
  it('serves shared indexes without reparsing, supports exact HEAD/Range, revokes downloads and rejects changed versions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cpm-service-'))
    const bytes = packageFixture()
    const path = join(root, 'game.pkg')
    await writeFile(path, bytes)
    const runtime = await createNodeLibrary(join(root, 'index.sqlite'))
    const library = await runtime.engine.createLibrary('Games', [
      { id: 'folder', name: 'folder', type: 'folder', root },
    ])
    const token = 'administrator-token-at-least-32-characters'
    const server = await createLibraryServer({ ...runtime, adminToken: token, baseUrl: 'http://127.0.0.1:54321' })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    await runtime.engine.idle()
    const address = `http://127.0.0.1:${(server.address() as any).port}`
    const admin = new RemoteLibraryClient(address, token)
    try {
      expect((await admin.listFiles(library.id)).items[0].state).toBe('ready')
      const grant = await admin.createShare(library.id)
      const shared = new RemoteLibraryClient(`${address}/#token=${grant.token}`)
      expect((await shared.capabilities()).writable).toBe(false)
      const file = (await shared.listFiles(library.id)).items[0]
      expect(file.path).toBeUndefined()
      expect(JSON.stringify(await shared.listLibraries())).not.toContain(root)
      await expect(shared.scan(library.id)).rejects.toThrow('Administrator')
      expect((await shared.asset(file.coverId!)).bytes.length).toBeGreaterThan(8)
      const download = await shared.download(file.id)
      const url = download.url!.replace('http://127.0.0.1:54321', address)
      const head = await fetch(url, { method: 'HEAD' })
      expect(head.status).toBe(200)
      expect(Number(head.headers.get('content-length'))).toBe(bytes.length)
      const response = await fetch(url, { headers: { Range: 'bytes=0-3' } })
      expect(response.status).toBe(206)
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(bytes.subarray(0, 4)))
      expect((await fetch(url, { headers: { Range: 'bytes=999999-' } })).status).toBe(416)
      await admin.revokeShare(grant.id)
      expect((await fetch(url)).status).toBe(403)
      await expect(shared.listLibraries()).rejects.toThrow('Authorization')
      const current = await admin.download(file.id)
      await writeFile(path, Buffer.concat([bytes, Buffer.from([0])]))
      expect((await fetch(current.url!.replace('http://127.0.0.1:54321', address))).status).toBe(409)
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
      await runtime.engine.close()
    }
    const restarted = await createNodeLibrary(join(root, 'index.sqlite'))
    expect((await restarted.engine.listFiles(library.id)).items).toHaveLength(1)
    await restarted.engine.close()
    await rm(root, { recursive: true, force: true })
  })
})
