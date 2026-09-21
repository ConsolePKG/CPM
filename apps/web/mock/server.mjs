// Development-only fixture: isolated origin, local fake PS4 endpoints, never imported by the app.
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { advanceTransfer } from './transfer.mjs'
const root = path.resolve(import.meta.dirname, '../../..')
const seed = {
  WebAlertV1: true,
  'cpm-theme': 'dark',
  fileServerHosts: [
    {
      id: 'fixture-source',
      alias: 'NAS / PS4',
      type: 'StaticFileServer',
      url: 'http://localhost:4181',
      recursiveQuery: true,
    },
  ],
  curFileServerHostId: 'fixture-source',
  ps4Hosts: [
    { id: 'fixture-console', alias: 'PS4 · 客厅', url: 'http://localhost:4181' },
    { id: 'fixture-console-2', alias: 'PS4 · 书房', url: 'http://localhost:4182' },
  ],
  curSelectPs4HostId: 'fixture-console',
}

function seedScript(reset = false) {
  return `if (${reset} || localStorage.getItem('cpm-mock-version') !== '1') {
    const seed = ${JSON.stringify(seed)};
    for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, key === 'cpm-theme' ? value : JSON.stringify(value));
    localStorage.setItem('cpm-mock-version', '1');
  }`
}

const covers = JSON.parse(await readFile(new URL('./covers/sources.json', import.meta.url), 'utf8'))
const files = covers.map(({ name, file: cover }, i) => ({
  filename: `/${name}.pkg`,
  basename: name + '.pkg',
  type: 'file',
  size: (45 + i) * 1024 ** 3,
  lastmod: '2026-09-20T00:00:00Z',
  icon0: `http://localhost:4180/covers/${cover}?v=ps-square-1`,
  paramSfo: { TITLE: name, TITLE_ID: `CUSA00${i}`, CATEGORY: 'gd', CONTENT_ID: 'TEST-CONTENT-' + i, APP_VER: '01.00' },
}))
files.push({
  ...files[1],
  filename: `/${covers[1].name} patch.pkg`,
  basename: `${covers[1].name} patch.pkg`,
  size: 2 * 1024 ** 3,
  paramSfo: { ...files[1].paramSfo, CATEGORY: 'gp', APP_VER: '01.10' },
})
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
}
function json(res, body, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}
for (const port of [4180, 4181, 4182]) {
  const tasks = new Map()
  let nextId = 1
  http
    .createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      if (req.method === 'OPTIONS') {
        res.end()
        return
      }
      const url = new URL(req.url, `http://localhost:${port}`)
      try {
        if (url.pathname === '/__fixture') {
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(`<script>${seedScript(true)}location.replace('/')</script>`)
          return
        }
        if (url.pathname === '/api/files') {
          json(res, files)
          return
        }
        if (url.pathname === '/api') {
          json(res, { status: 'fail' }, 400)
          return
        }
        if (url.pathname.startsWith('/api/')) {
          let raw = ''
          for await (const chunk of req) raw += chunk
          const data = raw ? JSON.parse(raw) : JSON.parse(url.searchParams.get('data') || '{}')
          const operation = url.pathname.split('/').pop()
          console.log(JSON.stringify({ port, operation, task: data.task_id }))
          if (operation === 'install') {
            const id = nextId++
            const title = decodeURI(data.packages[0].split('/').pop()).replace('.pkg', '')
            tasks.set(id, {
              title,
              transferred: 8 * 1024 ** 3,
              total: 45 * 1024 ** 3,
              paused: false,
              updatedAt: Date.now(),
              activeSeconds: 0,
              phase: id * 1.7,
            })
            json(res, { status: 'success', task_id: id, title })
            return
          }
          const task = tasks.get(data.task_id)
          if (!task) {
            json(res, { status: 'fail', error_code: 404 })
            return
          }
          const remaining = advanceTransfer(task)
          if (operation === 'get_task_progress') {
            json(res, {
              status: 'success',
              transferred_total: Math.floor(task.transferred),
              length_total: task.total,
              rest_sec: remaining,
            })
            return
          }
          if (operation === 'pause_task') task.paused = true
          if (operation === 'resume_task') task.paused = false
          if (operation === 'unregister_task') tasks.delete(data.task_id)
          json(res, { status: 'success' })
          return
        }
        const file = url.pathname.startsWith('/covers/')
          ? path.join(import.meta.dirname, 'covers', path.basename(url.pathname))
          : path.join(root, 'apps/web/dist', url.pathname === '/' ? 'index.html' : url.pathname)
        const bytes = await readFile(file)
        res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream')
        if (path.extname(file) === '.html') {
          res.end(
            bytes
              .toString()
              .replace(
                '<head>',
                `<head>
            <meta http-equiv="Content-Security-Policy" content="connect-src 'self' http://localhost:4181 http://localhost:4182">
            <script>${seedScript()}</script>
            <style>.app-brand::after{content:'MOCK';font:600 10px/1.4 sans-serif;letter-spacing:.5px;padding:3px 6px;border:1px solid currentColor;border-radius:4px;color:var(--muted)}</style>
          `,
              )
              .replace('<title>CPM</title>', '<title>CPM · Mock</title>'),
          )
        } else res.end(bytes)
      } catch {
        res.writeHead(404)
        res.end('Not found')
      }
    })
    .listen(port, '127.0.0.1', () => console.log(`CPM mock ${port === 4180 ? 'UI' : 'API'}: http://localhost:${port}`))
}
