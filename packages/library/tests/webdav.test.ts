import { describe, expect, it } from '@rstest/core'
import { createServer } from 'node:http'
import { WebDAVSource } from '../src/webdav'
import { packageParser } from '../src/parser'
import { BrowserFilesSource } from '../src/browser'
import { packageFixture } from './fixtures'

describe('authenticated WebDAV byte source', () => {
  it('enumerates and parses the same fixture as browser files, without exposing authentication in download URLs', async () => {
    const bytes = packageFixture()
    const authorization = `Basic ${Buffer.from('user:secret').toString('base64')}`
    const server = createServer((request, response) => {
      if (request.headers.authorization !== authorization) {
        response.writeHead(401).end()
        return
      }
      if (request.method === 'PROPFIND') {
        response
          .writeHead(207, { 'Content-Type': 'application/xml' })
          .end(
            `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>/game.pkg</d:href><d:propstat><d:prop><d:displayname>game.pkg</d:displayname><d:getcontentlength>${bytes.length}</d:getcontentlength><d:getlastmodified>Wed, 30 Sep 2026 00:00:00 GMT</d:getlastmodified><d:getetag>"fixture-1"</d:getetag><d:resourcetype/></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`,
          )
        return
      }
      const range = /^bytes=(\d+)-(\d+)$/.exec(request.headers.range || '')
      if (!range) {
        response.writeHead(416).end()
        return
      }
      const start = Number(range[1]),
        end = Number(range[2])
      response
        .writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${bytes.length}`, 'Content-Length': end - start + 1 })
        .end(bytes.subarray(start, end + 1))
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = `http://127.0.0.1:${(server.address() as any).port}`
    try {
      const source = new WebDAVSource({
        id: 'dav',
        name: 'dav',
        type: 'webdav',
        url: address,
        username: 'user',
        password: 'secret',
      })
      const entries = []
      for await (const entry of source.entries()) entries.push(entry)
      expect(entries.map((entry) => entry.path)).toEqual(['/game.pkg'])
      expect((await source.stat('/game.pkg')).etag).toBe('fixture-1')
      const browser = await new BrowserFilesSource(
        { id: 'files', name: 'files', type: 'browser-files' },
        new Map([['game.pkg', new File([bytes], 'game.pkg')]]),
      ).open('game.pkg')
      expect(await packageParser.parse(await source.open('/game.pkg'))).toEqual(await packageParser.parse(browser))
      expect(await source.download('/game.pkg')).toBeUndefined()
      const rejected = new WebDAVSource({ id: 'bad', name: 'bad', type: 'webdav', url: address })
      await expect((await rejected.open('/game.pkg')).readRange(0, 4)).rejects.toMatchObject({ code: 'source_auth' })
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
  it('rejects mismatched Content-Range even when the body has the requested size', async () => {
    const source = new WebDAVSource(
      { id: 'dav', name: 'dav', type: 'webdav', url: 'https://dav.test' },
      async () => new Response(new Uint8Array(4), { status: 206, headers: { 'Content-Range': 'bytes 0-7/16' } }),
    )
    await expect((await source.open('/game.pkg')).readRange(0, 4)).rejects.toThrow('Range')
  })
  it('propagates caller cancellation to upstream reads', async () => {
    const controller = new AbortController()
    let started!: () => void
    const ready = new Promise<void>((resolve) => {
      started = resolve
    })
    const source = new WebDAVSource(
      { id: 'dav', name: 'dav', type: 'webdav', url: 'https://dav.test' },
      async (_address, options) =>
        new Promise<Response>((_resolve, reject) => {
          options!.signal!.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
          started()
        }),
    )
    const read = (await source.open('/game.pkg')).readRange(0, 4, controller.signal)
    const assertion = expect(read).rejects.toThrow('aborted')
    await ready
    controller.abort()
    await assertion
  })
})
