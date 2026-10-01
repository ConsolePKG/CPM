import { app } from 'electron'
import { randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Server } from 'node:http'
import { Worker } from 'node:worker_threads'
import { createNodeLibrary, createLibraryServer, nodeWorkerParser } from '@consolepkg/library/node'
import type { SourceConfig } from '@consolepkg/library'
import { getIp } from './utils'

class StaticServerManager {
  server?: Server
  private runtime?: Awaited<ReturnType<typeof createNodeLibrary>>
  private address?: string
  private token?: string
  private operations: Promise<unknown> = Promise.resolve()
  createServer(options: { directoryPath: string; port: number; preferredInterface?: string }) {
    const { directoryPath, ...serverOptions } = options
    return this.createSourceServer({
      ...serverOptions,
      source: {
        id: randomBytes(16).toString('hex'),
        name: directoryPath.split(/[\\/]/).pop() || 'Games',
        type: 'folder',
        root: directoryPath,
      },
    })
  }
  createWebDAVLibrary(options: { source: SourceConfig; preferredInterface?: string }) {
    return this.createSourceServer({ ...options, port: 0 })
  }
  private createSourceServer(options: { source: SourceConfig; port: number; preferredInterface?: string }) {
    const operation = this.operations.then(() => this.startServer(options))
    this.operations = operation.catch(() => {})
    return operation
  }
  private async ensureLibrary(source: SourceConfig) {
    const engine = this.runtime!.engine
    const libraries = await engine.listLibraries()
    let library = libraries.find((item) =>
      item.sources.some((value) =>
        source.type === 'folder' ? value.type === 'folder' && value.root === source.root : value.id === source.id,
      ),
    )
    if (!library) library = await engine.createLibrary(source.name, [source])
    else if (source.type === 'webdav') {
      const existing = library.sources.find((value) => value.id === source.id)
      if (JSON.stringify(existing) !== JSON.stringify(source)) {
        await engine.idle()
        library = await engine.updateSource(library.id, source)
      }
    }
    await engine.scan(library.id)
    return library
  }
  private async startServer({
    source,
    port,
    preferredInterface,
  }: {
    source: SourceConfig
    port: number
    preferredInterface?: string
  }): Promise<{ url?: string; token?: string; libraryId?: string; errorMessage?: string }> {
    try {
      const address = preferredInterface || getIp()
      if (!address) throw new Error('没有主机可达的网络接口')
      const selectedPort = port || (this.server?.listening ? (this.server.address() as { port: number }).port : 0)
      let url = 'http://' + address + ':' + selectedPort
      if (this.server?.listening && this.address === url && this.runtime && this.token) {
        const library = await this.ensureLibrary(source)
        return { url, token: this.token, libraryId: library.id }
      }
      if (this.server) {
        this.server.closeAllConnections()
        await new Promise<void>((resolve) => this.server!.close(() => resolve()))
        this.server = undefined
      }
      if (this.runtime) await this.runtime.engine.close()
      const directory = app.getPath('userData')
      const tokenPath = join(directory, 'library-admin-token')
      let token: string
      try {
        token = (await readFile(tokenPath, 'utf8')).trim()
      } catch {
        token = randomBytes(32).toString('base64url')
        await writeFile(tokenPath, token, { mode: 0o600, flag: 'wx' })
      }
      this.runtime = await createNodeLibrary(join(directory, 'library.sqlite'), {
        parser: nodeWorkerParser(() => new Worker(join(__dirname, 'libraryParser.js'))),
      })
      const library = await this.ensureLibrary(source)
      this.server = await createLibraryServer({ ...this.runtime, adminToken: token, baseUrl: url })
      await new Promise<void>((resolve, reject) => {
        this.server!.once('error', reject)
        this.server!.listen(selectedPort, '0.0.0.0', resolve)
      })
      url = 'http://' + address + ':' + (this.server.address() as { port: number }).port
      this.address = url
      this.token = token
      return { url, token, libraryId: library.id }
    } catch (error) {
      return { errorMessage: (error as Error).message }
    }
  }
}
export const staticServerManager = new StaticServerManager()
