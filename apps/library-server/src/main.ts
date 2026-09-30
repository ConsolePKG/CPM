import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import { createNodeLibrary, createLibraryServer } from '@consolepkg/library/node'

const directory = process.env.CPM_DATA || './data'
await mkdir(directory, { recursive: true })
const tokenPath = resolve(directory, 'admin-token')
let adminToken = process.env.CPM_ADMIN_TOKEN
if (!adminToken) {
  try {
    adminToken = (await readFile(tokenPath, 'utf8')).trim()
  } catch {
    adminToken = randomBytes(32).toString('base64url')
    await writeFile(tokenPath, adminToken, { mode: 0o600, flag: 'wx' })
  }
}
const { engine, store } = await createNodeLibrary(resolve(directory, 'library.sqlite'))
if (!(await engine.listLibraries()).length && process.env.CPM_LIBRARY_ROOT)
  await engine.createLibrary('Games', [
    { id: 'mounted-folder', name: 'Game files', type: 'folder', root: process.env.CPM_LIBRARY_ROOT },
  ])
const server = await createLibraryServer({
  engine,
  store,
  adminToken,
  baseUrl: process.env.CPM_EXTERNAL_URL,
  webRoot: process.env.CPM_WEB_ROOT || resolve('../web/dist'),
  allowedOrigins: process.env.CPM_ALLOWED_ORIGINS?.split(','),
})
server.listen(Number(process.env.PORT || 8080), '0.0.0.0', () =>
  console.log(`ConsolePKG library listening on ${process.env.PORT || 8080}; administrator token: ${tokenPath}`),
)
const stop = () => {
  server.close(async () => {
    await engine.close()
    process.exit(0)
  })
  server.closeIdleConnections()
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
