import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import { resolve, relative, isAbsolute } from 'node:path'
import type { LibraryEngine } from '../core'
import { LibraryError, newId, type ListQuery } from '../types'
import type { SQLiteStore } from './store'

type Options = {
  engine: LibraryEngine
  store: SQLiteStore
  adminToken: string
  baseUrl?: string
  webRoot?: string
  allowedOrigins?: string[]
  scanInterval?: number
}
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const equal = (first: string, second: string) =>
  timingSafeEqual(Buffer.from(digest(first)), Buffer.from(digest(second)))
const publicFile = (file: any) => {
  const { path, ...value } = file
  return {
    ...value,
    message: file.message
      ? file.state === 'failed'
        ? 'Parsing failed; administrator can retry'
        : 'Metadata is incomplete or unsupported'
      : undefined,
  }
}
const publicLibrary = (library: any) => ({
  ...library,
  sources: library.sources.map(({ id, name, type }: any) => ({ id, name, type })),
})

export async function createLibraryServer(options: Options) {
  const { engine, store } = options
  const webRoot = options.webRoot ? await realpath(options.webRoot) : undefined
  if (options.adminToken.length < 32) throw new Error('Administrator token must have at least 32 characters')
  const configuredBase = options.baseUrl ? new URL(options.baseUrl) : undefined
  if (configuredBase && !['http:', 'https:'].includes(configuredBase.protocol))
    throw new Error('External base URL must use HTTP(S)')
  const secret = options.adminToken
  const grants = store.database
  const signature = (payload: string) => createHmac('sha256', secret).update(payload).digest('base64url')
  const readBody = async (request: IncomingMessage) => {
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of request) {
      size += chunk.length
      if (size > 256 * 1024) throw new LibraryError('body_too_large', 'Request body too large', 413)
      chunks.push(chunk)
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString() || '{}')
    } catch {
      throw new LibraryError('invalid_json', 'Invalid JSON')
    }
  }
  const server = createServer(async (request, response) => {
    const json = (value: unknown, status = 200) => {
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      response.end(JSON.stringify(value))
    }
    try {
      const url = new URL(request.url || '/', 'http://library.local')
      const origin = request.headers.origin
      if (origin) {
        if (options.allowedOrigins?.length && !options.allowedOrigins.includes(origin))
          throw new LibraryError('origin_denied', 'Origin not allowed', 403)
        response.setHeader('Access-Control-Allow-Origin', origin)
        response.setHeader('Vary', 'Origin')
        response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Range')
        response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS')
        response.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges')
      }
      if (request.method === 'OPTIONS') {
        response.writeHead(204)
        response.end()
        return
      }
      const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
      if (parts[0] !== 'api' || parts[1] !== 'v1') {
        if (!options.webRoot || !['GET', 'HEAD'].includes(request.method || ''))
          throw new LibraryError('not_found', 'Not found', 404)
        const target = resolve(webRoot!, `.${decodeURIComponent(url.pathname)}`)
        const boundary = relative(webRoot!, target)
        if (boundary.startsWith('..') || isAbsolute(boundary))
          throw new LibraryError('forbidden', 'Invalid static path', 403)
        const path = await stat(target)
          .then((info) => (info.isFile() ? target : resolve(webRoot!, 'index.html')))
          .catch(() => resolve(webRoot!, 'index.html'))
        const canonical = await realpath(path)
        const canonicalBoundary = relative(webRoot!, canonical)
        if (canonicalBoundary.startsWith('..') || isAbsolute(canonicalBoundary))
          throw new LibraryError('forbidden', 'Static file outside WebUI root', 403)
        const mime: Record<string, string> = {
          html: 'text/html',
          js: 'text/javascript',
          css: 'text/css',
          png: 'image/png',
          svg: 'image/svg+xml',
          json: 'application/json',
          wasm: 'application/wasm',
        }
        response.writeHead(200, { 'Content-Type': mime[path.split('.').pop()!] || 'application/octet-stream' })
        response.end(request.method === 'HEAD' ? undefined : await readFile(canonical))
        return
      }
      const route = parts.slice(2)
      const token = request.headers.authorization?.replace(/^Bearer /, '') || ''
      const admin = !!token && equal(token, options.adminToken)
      const grant =
        !admin && token
          ? (grants.prepare('SELECT id,library FROM grants WHERE digest=? AND revoked=0').get(digest(token)) as
              | { id: string; library: string }
              | undefined)
          : undefined
      const allow = (libraryId: string) => {
        if (!admin && grant?.library !== libraryId) throw new LibraryError('forbidden', 'Access denied', 403)
      }
      const requireAdmin = () => {
        if (!admin) throw new LibraryError('admin_required', 'Administrator authorization required', 403)
      }
      const query: ListQuery = {
        cursor: url.searchParams.get('cursor') || undefined,
        limit: url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : undefined,
        search: url.searchParams.get('search') || undefined,
        sourceId: url.searchParams.get('sourceId') || undefined,
      }
      if (route[0] === 'downloads' && route[1]) {
        const signed = url.searchParams.get('token') || ''
        const [payload, proof, extra] = signed.split('.')
        if (!payload || !proof || extra || !equal(proof, signature(payload)))
          throw new LibraryError('invalid_download', 'Invalid download authorization', 403)
        let authorization: any
        try {
          authorization = JSON.parse(Buffer.from(payload, 'base64url').toString())
        } catch {
          throw new LibraryError('invalid_download', 'Invalid download authorization', 403)
        }
        if (authorization.file !== route[1] || authorization.expires < Date.now())
          throw new LibraryError('expired_download', 'Download expired', 403)
        if (
          authorization.grant &&
          !grants.prepare('SELECT id FROM grants WHERE id=? AND revoked=0').get(authorization.grant)
        )
          throw new LibraryError('revoked_share', 'Share revoked', 403)
        const file = await engine.getFile(route[1])
        if (file.fileVersion !== authorization.version)
          throw new LibraryError('file_changed', 'Download version changed', 409)
        if (!['GET', 'HEAD'].includes(request.method || ''))
          throw new LibraryError('method_not_allowed', 'GET or HEAD required', 405)
        const { reader } = await engine.openFile(file.id)
        try {
          let start = 0
          let end = file.size - 1
          const range = request.headers.range
          if (range) {
            const match = /^bytes=(\d*)-(\d*)$/.exec(range)
            if (!match || (!match[1] && !match[2])) throw new LibraryError('invalid_range', 'Invalid Range', 416)
            if (!match[1]) start = Math.max(0, file.size - Number(match[2]))
            else {
              start = Number(match[1])
              if (match[2]) end = Math.min(end, Number(match[2]))
            }
            if (
              !Number.isSafeInteger(start) ||
              !Number.isSafeInteger(end) ||
              start < 0 ||
              end < start ||
              start >= file.size
            ) {
              response.setHeader('Content-Range', `bytes */${file.size}`)
              throw new LibraryError('invalid_range', 'Unsatisfiable Range', 416)
            }
          }
          response.writeHead(range ? 206 : 200, {
            'Content-Type': 'application/octet-stream',
            'Accept-Ranges': 'bytes',
            'Content-Length': Math.max(0, end - start + 1),
            'Cache-Control': 'no-store',
            ...(range ? { 'Content-Range': `bytes ${start}-${end}/${file.size}` } : {}),
          })
          if (request.method !== 'HEAD')
            for (let offset = start; offset <= end && !response.destroyed; offset += 1024 * 1024) {
              const bytes = await reader.readRange(offset, Math.min(1024 * 1024, end - offset + 1))
              if (!response.write(bytes))
                await new Promise<void>((resolve, reject) => {
                  const cleanup = () => {
                    response.off('drain', drained)
                    response.off('close', closed)
                    response.off('error', failed)
                  }
                  const drained = () => {
                    cleanup()
                    resolve()
                  }
                  const closed = () => {
                    cleanup()
                    resolve()
                  }
                  const failed = (error: Error) => {
                    cleanup()
                    reject(error)
                  }
                  response.once('drain', drained)
                  response.once('close', closed)
                  response.once('error', failed)
                })
            }
          response.end()
        } finally {
          await reader.close?.()
        }
        return
      }
      if (!admin && !grant) throw new LibraryError('unauthorized', 'Authorization required', 401)
      if (route[0] === 'capabilities') {
        json({ ...(await engine.capabilities()), writable: admin })
        return
      }
      if (route[0] === 'libraries' && !route[1]) {
        if (request.method === 'POST') {
          requireAdmin()
          const body = await readBody(request)
          json(await engine.createLibrary(body.name, body.sources), 201)
        } else
          json(
            (await engine.listLibraries())
              .filter((library) => admin || grant?.library === library.id)
              .map((library) => (admin ? library : publicLibrary(library))),
          )
        return
      }
      if (route[0] === 'libraries' && route[1]) {
        const libraryId = route[1]
        allow(libraryId)
        if (route[2] === 'sources' && request.method === 'POST') {
          requireAdmin()
          if (route[4] === 'remove') {
            await engine.removeSource(libraryId, route[3])
            json({ removed: true })
          } else
            json(
              route[3]
                ? await engine.updateSource(libraryId, { ...(await readBody(request)), id: route[3] })
                : await engine.addSource(libraryId, await readBody(request)),
            )
          return
        }
        if (route[2] === 'files') {
          const page = await engine.listFiles(libraryId, query)
          json({ ...page, items: page.items.map(publicFile) })
          return
        }
        if (route[2] === 'games') {
          json(route[3] ? await engine.getGame(libraryId, route[3]) : await engine.listGames(libraryId, query))
          return
        }
        if (route[2] === 'changes') {
          const change = await engine.changes(libraryId, Number(url.searchParams.get('after') || 0))
          json({ ...change, files: change.files.map(publicFile) })
          return
        }
        if (route[2] === 'scans' && request.method === 'POST') {
          requireAdmin()
          json(await engine.scan(libraryId), 202)
          return
        }
        if (route[2] === 'shares') {
          requireAdmin()
          if (request.method === 'POST') {
            const shareToken = randomBytes(32).toString('base64url')
            const id = newId('share')
            grants
              .prepare('INSERT INTO grants (id,digest,library) VALUES (?,?,?)')
              .run(id, digest(shareToken), libraryId)
            json({ id, libraryId, token: shareToken }, 201)
          } else
            json(grants.prepare('SELECT id,library AS libraryId,revoked FROM grants WHERE library=?').all(libraryId))
          return
        }
      }
      if (route[0] === 'shares' && route[2] === 'revoke' && request.method === 'POST') {
        requireAdmin()
        grants.prepare('UPDATE grants SET revoked=1 WHERE id=?').run(route[1])
        json({ revoked: true })
        return
      }
      if (route[0] === 'scans') {
        requireAdmin()
        json(await engine.getScan(route[1]))
        return
      }
      if (route[0] === 'assets') {
        const libraries = await engine.listLibraries()
        let permitted = false
        for (const library of libraries)
          if (admin || grant?.library === library.id) {
            let cursor: string | undefined
            do {
              const page = await engine.listFiles(library.id, { cursor, limit: 200 })
              permitted ||= page.items.some((file) => file.coverId === route[1])
              cursor = page.nextCursor
            } while (cursor && !permitted)
          }
        if (!permitted) throw new LibraryError('forbidden', 'Asset not shared', 403)
        const asset = await engine.asset(route[1])
        response.writeHead(200, { 'Content-Type': asset.contentType })
        response.end(asset.bytes)
        return
      }
      if (route[0] === 'files') {
        const file = await engine.getFile(route[1])
        allow(file.libraryId)
        if (!route[2]) {
          json(publicFile(file))
          return
        }
        if (route[2] === 'retry' && request.method === 'POST') {
          requireAdmin()
          await engine.retry(file.id)
          json({ queued: true }, 202)
          return
        }
        if (route[2] === 'resources') {
          const resource: any = await engine.resource(file.id, route[3], url.searchParams.get('key') || undefined)
          if (resource?.bytes) {
            response.writeHead(200, { 'Content-Type': resource.contentType })
            response.end(resource.bytes)
          } else json(resource)
          return
        }
        if (route[2] === 'download' && request.method === 'POST') {
          // Owners can give the console a direct source URL. Shared downloads
          // keep scoped, revocable tokens and never expose upstream credentials.
          if (admin) {
            const direct = await engine.download(file.id)
            if (direct.url) {
              json(direct)
              return
            }
          }
          const external = configuredBase && new URL(configuredBase.href)
          if (external?.port === '0') {
            const address = server.address()
            if (address && typeof address !== 'string') external.port = String(address.port)
          }
          const base = external?.href.replace(/\/$/, '')
          if (!base) {
            json({ fileVersion: file.fileVersion, unavailable: 'Configure a console-reachable external base URL' })
            return
          }
          const { reader } = await engine.openFile(file.id)
          await reader.close?.()
          const expires = Date.now() + 24 * 60 * 60 * 1000
          const payload = Buffer.from(
            JSON.stringify({ file: file.id, version: file.fileVersion, expires, grant: grant?.id }),
          ).toString('base64url')
          json({
            url: `${base}/api/v1/downloads/${encodeURIComponent(file.id)}?token=${payload}.${signature(payload)}`,
            fileVersion: file.fileVersion,
            expiresAt: new Date(expires).toISOString(),
          })
          return
        }
      }
      throw new LibraryError('not_found', 'Unknown endpoint', 404)
    } catch (error) {
      if (response.headersSent) {
        response.destroy()
        return
      }
      const known = error instanceof LibraryError
      json(
        { code: known ? error.code : 'service_error', message: known ? error.message : 'Library operation failed' },
        known ? error.status : 500,
      )
    }
  })
  const scanAll = async () => {
    for (const library of await engine.listLibraries()) await engine.scan(library.id).catch(() => {})
  }
  const interval = setInterval(
    () => {
      void scanAll()
    },
    options.scanInterval ?? 15 * 60 * 1000,
  )
  interval.unref()
  server.on('close', () => clearInterval(interval))
  await scanAll()
  return server
}
