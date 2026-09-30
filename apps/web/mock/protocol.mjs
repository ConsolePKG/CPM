import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'

export function createProtocolMock({ platform = 'ps4', files = [], now = () => Date.now(), demo = false } = {}) {
  const jobs = new Map()
  const shares = new Map()
  const downloads = new Map()
  const lostResponses = new Set()
  let nextJob = 1
  const indexed = files.map((file, index) => ({
    id: `file-${index}`,
    libraryId: 'fixture-library',
    sourceId: 'fixture-source',
    name: file.basename,
    size: file.size,
    modified: file.lastmod,
    etag: file.etag || 'fixture',
    fileVersion: 'fixture-v1',
    parserVersion: 'fixture',
    available: true,
    state: 'ready',
    revision: index + 1,
    coverId: `cover-${index}`,
    metadata: {
      platform: 'ps4',
      format: 'ps4-pkg',
      kind: file.paramSfo?.CATEGORY === 'gp' ? 'patch' : file.paramSfo?.CATEGORY === 'ac' ? 'dlc' : 'base',
      title: file.paramSfo?.TITLE,
      titleId: file.paramSfo?.TITLE_ID,
      contentId: file.paramSfo?.CONTENT_ID,
      version: file.paramSfo?.APP_VER,
      raw: file.paramSfo || {},
    },
  }))
  const advance = (job) => {
    if (['completed', 'failed', 'cancelled', 'paused', 'unknown'].includes(job.state)) return
    const elapsed = Math.max(0, now() - job.createdAt)
    job.state =
      elapsed < 1000
        ? 'queued'
        : elapsed < 2000
          ? 'submitting'
          : elapsed < 3000
            ? 'accepted'
            : elapsed < 15000
              ? 'transferring'
              : elapsed < 18000
                ? 'installing'
                : 'completed'
    const speed = demo ? 1 + Math.sin(elapsed / 2000) * 0.04 : 1
    job.progress.transferred = Math.min(
      job.progress.total,
      Math.max(0, Math.floor(((elapsed - 3000) / 12000) * job.progress.total * speed)),
    )
  }
  const wire = (job) => {
    advance(job)
    const { request, createdAt, ...value } = job
    return value
  }
  return {
    jobs,
    fail(jobId, message = 'Injected native failure') {
      const job = jobs.get(jobId)
      job.state = 'failed'
      job.error = message
      job.errorCode = -1
    },
    loseNextResponse(key) {
      lostResponses.add(key)
    },
    async handle(request, response, origin) {
      response.setHeader('Access-Control-Allow-Origin', '*')
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Range')
      response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS')
      response.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges')
      if (request.method === 'OPTIONS') {
        response.writeHead(204)
        response.end()
        return true
      }
      const url = new URL(request.url, origin)
      if (!url.pathname.startsWith('/api/v1/')) return false
      const json = (value, status = 200) => {
        response.writeHead(status, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify(value))
      }
      const fail = (message, status) => json({ code: 'fixture_error', message }, status)
      const read = async () => {
        let text = ''
        for await (const chunk of request) text += chunk
        return JSON.parse(text || '{}')
      }
      const route = url.pathname.slice(8).split('/').map(decodeURIComponent)
      const token = request.headers.authorization?.replace('Bearer ', '')
      const admin = token === 'fixture-admin'
      if (route[0] === 'downloads') {
        const authorization = downloads.get(url.searchParams.get('token'))
        const file = indexed.find((file) => file.id === route[1])
        if (
          !authorization ||
          authorization.file !== file?.id ||
          authorization.expires <= now() ||
          (authorization.share && ![...shares.values()].includes(authorization.share))
        ) {
          fail('Download authorization expired or revoked', 403)
          return true
        }
        if (authorization.version !== file.fileVersion) {
          fail('Download version changed', 409)
          return true
        }
        if (!['GET', 'HEAD'].includes(request.method)) {
          fail('GET or HEAD required', 405)
          return true
        }
        let start = 0,
          end = file.size - 1
        const range = request.headers.range
        if (range) {
          const match = /^bytes=(\d*)-(\d*)$/.exec(range)
          if (!match || (!match[1] && !match[2])) {
            fail('Invalid Range', 416)
            return true
          }
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
            fail('Unsatisfiable Range', 416)
            return true
          }
        }
        response.writeHead(range ? 206 : 200, {
          'Content-Type': 'application/octet-stream',
          'Accept-Ranges': 'bytes',
          'Content-Length': Math.max(0, end - start + 1),
          ...(range ? { 'Content-Range': `bytes ${start}-${end}/${file.size}` } : {}),
        })
        if (request.method === 'HEAD') response.end()
        else
          Readable.from(
            (async function* () {
              for (let offset = start; offset <= end; offset += 65536) {
                const chunk = Buffer.alloc(Math.min(65536, end - offset + 1))
                if (offset < 4) Buffer.from([127, 67, 78, 84]).copy(chunk, 0, offset, Math.min(4, end + 1))
                yield chunk
              }
            })(),
          ).pipe(response)
        return true
      }
      if (route[0] === 'capabilities') {
        json({
          protocolVersion: 1,
          persistence: 'sqlite',
          publishing: true,
          writable: admin,
          platform,
          jobs: true,
          pause: platform === 'ps4',
          resume: platform === 'ps4',
          cancel: platform === 'ps4',
          retry: true,
          completionVerified: true,
        })
        return true
      }
      if (route[0] === 'jobs') {
        if (!route[1] && request.method === 'POST') {
          const submission = await read()
          if (!submission.idempotencyKey || !/^https?:\/\//.test(submission.url || '')) {
            fail('Invalid submission', 400)
            return true
          }
          let job = [...jobs.values()].find((job) => job.idempotencyKey === submission.idempotencyKey)
          if (job && JSON.stringify(job.request) !== JSON.stringify(submission)) {
            fail('Idempotency key conflict', 409)
            return true
          }
          if (!job) {
            if (
              [...jobs.values()].some(
                (job) =>
                  ((submission.contentId && job.request.contentId === submission.contentId) ||
                    (platform === 'ps5' && (!submission.contentId || !job.request.contentId))) &&
                  !['completed', 'failed', 'cancelled'].includes(wire(job).state),
              )
            ) {
              fail('Active content installation', 409)
              return true
            }
            const jobId = String(nextJob++)
            job = {
              jobId,
              idempotencyKey: submission.idempotencyKey,
              platform,
              title: submission.title || 'Fixture',
              nativeRef:
                platform === 'ps4'
                  ? { task_id: 100 + Number(jobId) }
                  : { content_id: submission.contentId || 'UP0001-CUSA12345_00-ABCDEFGHIJKLMNOP' },
              state: 'queued',
              progress: { transferred: 0, total: 1024 * 1024 },
              request: submission,
              createdAt: now(),
            }
            jobs.set(jobId, job)
          }
          if (lostResponses.delete(submission.idempotencyKey)) {
            response.destroy()
            return true
          }
          json(wire(job), 202)
          return true
        }
        if (!route[1]) {
          const cursor = Number(url.searchParams.get('cursor') || 0),
            limit = Number(url.searchParams.get('limit') || 100)
          const eligible = [...jobs.values()].filter((job) => Number(job.jobId) > cursor)
          const items = eligible.slice(0, limit).map(wire)
          json({ items, ...(eligible.length > limit ? { nextCursor: items[items.length - 1].jobId } : {}) })
          return true
        }
        const job = jobs.get(route[1])
        if (!job) {
          fail('Job not found', 404)
          return true
        }
        if (route[2] === 'actions') {
          const { action, idempotencyKey } = await read()
          advance(job)
          if (action === 'retry') {
            if (
              !idempotencyKey ||
              idempotencyKey === job.idempotencyKey ||
              !['completed', 'failed', 'cancelled'].includes(job.state)
            ) {
              fail('Retry needs a new key and known terminal job', 409)
              return true
            }
            const body = JSON.stringify({ ...job.request, idempotencyKey })
            return this.handle(
              {
                method: 'POST',
                url: '/api/v1/jobs',
                headers: request.headers,
                async *[Symbol.asyncIterator]() {
                  yield body
                },
              },
              response,
              origin,
            )
          }
          if (platform !== 'ps4' || !['pause', 'resume', 'cancel'].includes(action)) {
            fail('Unsupported action', 501)
            return true
          }
          if (['completed', 'failed', 'cancelled', 'unknown'].includes(job.state)) {
            fail('Job is not controllable', 409)
            return true
          }
          if (action === 'pause') job.pausedAt = now()
          if (action === 'resume' && job.pausedAt !== undefined) {
            job.createdAt += now() - job.pausedAt
            delete job.pausedAt
          }
          job.state = action === 'pause' ? 'paused' : action === 'resume' ? 'transferring' : 'cancelled'
        }
        json(wire(job))
        return true
      }
      if (!admin && !shares.has(token)) {
        fail('Authorization required', 401)
        return true
      }
      if (route[0] === 'libraries') {
        if (!route[1]) {
          json([
            {
              id: 'fixture-library',
              name: 'Fixture library',
              sources: [{ id: 'fixture-source', name: 'Fixture', type: 'folder' }],
              createdAt: new Date(0).toISOString(),
            },
          ])
          return true
        }
        if (route[2] === 'files') {
          const cursor = Number(url.searchParams.get('cursor') || 0),
            limit = Number(url.searchParams.get('limit') || 50)
          json({
            items: indexed.slice(cursor, cursor + limit),
            revision: indexed.length,
            ...(cursor + limit < indexed.length ? { nextCursor: String(cursor + limit) } : {}),
          })
          return true
        }
        if (route[2] === 'games') {
          const grouped = new Map()
          for (const file of indexed) {
            const key = file.metadata.titleId || file.id
            if (!grouped.has(key))
              grouped.set(key, {
                id: key,
                libraryId: 'fixture-library',
                platform: 'ps4',
                title: file.metadata.title,
                titleId: key,
                base: [],
                patches: [],
                dlcs: [],
                unknown: [],
              })
            grouped
              .get(key)
              [file.metadata.kind === 'base' ? 'base' : file.metadata.kind === 'patch' ? 'patches' : 'dlcs'].push(
                file.id,
              )
          }
          if (route[3]) {
            const game = grouped.get(route[3])
            if (!game) {
              json({ message: 'Game entry not found', code: 'game_not_found' }, 404)
              return true
            }
            json(game)
          } else json({ items: [...grouped.values()], revision: indexed.length })
          return true
        }
        if (route[2] === 'changes') {
          json({
            revision: indexed.length,
            reset: false,
            files: Number(url.searchParams.get('after')) < indexed.length ? indexed : [],
          })
          return true
        }
        if (route[2] === 'scans') {
          if (!admin) fail('Administrator required', 403)
          else
            json(
              {
                id: 'fixture-scan',
                libraryId: 'fixture-library',
                state: 'completed',
                discovered: indexed.length,
                parsed: indexed.length,
                errors: [],
              },
              202,
            )
          return true
        }
        if (route[2] === 'shares' && request.method === 'POST') {
          if (!admin) fail('Administrator required', 403)
          else {
            const id = `share-${shares.size + 1}`,
              token = `fixture-${id}`
            shares.set(token, id)
            json({ id, token, libraryId: 'fixture-library' }, 201)
          }
          return true
        }
        if (route[2] === 'shares') {
          json([...shares].map(([token, id]) => ({ id, libraryId: 'fixture-library' })))
          return true
        }
      }
      if (route[0] === 'shares' && route[2] === 'revoke') {
        if (!admin) fail('Administrator required', 403)
        else {
          for (const [token, id] of shares) if (id === route[1]) shares.delete(token)
          json({ revoked: true })
        }
        return true
      }
      if (route[0] === 'assets') {
        const index = Number(route[1].replace('cover-', ''))
        if (!files[index]?.icon0) {
          fail('Asset not found', 404)
          return true
        }
        const result = await fetch(files[index].icon0)
        response.writeHead(result.status, { 'Content-Type': result.headers.get('content-type') || 'image/png' })
        response.end(Buffer.from(await result.arrayBuffer()))
        return true
      }
      if (route[0] === 'files') {
        const file = indexed.find((file) => file.id === route[1])
        if (!file) {
          fail('File not found', 404)
          return true
        }
        if (route[2] === 'download') {
          const downloadToken = randomUUID()
          downloads.set(downloadToken, {
            file: file.id,
            version: file.fileVersion,
            share: shares.get(token),
            expires: now() + 86400000,
          })
          json({
            url: `${origin}/api/v1/downloads/${file.id}?token=${downloadToken}`,
            fileVersion: file.fileVersion,
            expiresAt: new Date(now() + 86400000).toISOString(),
          })
        } else if (route[2] === 'resources')
          json(route[3] === 'artwork' ? [] : { status: 'missing', reason: 'Fixture has no resource data' })
        else json(file)
        return true
      }
      fail('Not found', 404)
      return true
    },
  }
}
