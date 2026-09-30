import { app } from 'electron'
import { randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Server } from 'node:http'
import { Worker } from 'node:worker_threads'
import { createNodeLibrary, createLibraryServer, nodeWorkerParser } from '@consolepkg/library/node'
import { getIp } from './utils'

class StaticServerManager {
  server?: Server
  private runtime?: Awaited<ReturnType<typeof createNodeLibrary>>
  private address?: string
  private token?: string
  private operations: Promise<unknown> = Promise.resolve()
  createServer(options: { directoryPath: string; port: number; preferredInterface?: string }) {
    const operation = this.operations.then(() => this.startServer(options))
    this.operations = operation.catch(() => {})
    return operation
  }
  private async startServer({
    directoryPath,
    port,
    preferredInterface,
  }: {
    directoryPath: string
    port: number
    preferredInterface?: string
  }): Promise<{ url?: string; token?: string; libraryId?: string; errorMessage?: string }> {
    try {
      const address = preferredInterface || getIp()
      if (!address) throw new Error('没有主机可达的网络接口')
      const url = 'http://' + address + ':' + port
      if (this.server?.listening && this.address === url && this.runtime && this.token) {
        const libraries = await this.runtime.engine.listLibraries()
        const library =
          libraries.find((item) => item.sources.some((source) => source.root === directoryPath)) ||
          (await this.runtime.engine.createLibrary(directoryPath.split(/[\\/]/).pop() || 'Games', [
            { id: randomBytes(16).toString('hex'), name: 'Folder', type: 'folder', root: directoryPath },
          ]))
        await this.runtime.engine.scan(library.id)
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
      const libraries = await this.runtime.engine.listLibraries()
      const library =
        libraries.find((item) => item.sources.some((source) => source.root === directoryPath)) ||
        (await this.runtime.engine.createLibrary(directoryPath.split(/[\\/]/).pop() || 'Games', [
          { id: randomBytes(16).toString('hex'), name: 'Folder', type: 'folder', root: directoryPath },
        ]))
      this.server = await createLibraryServer({ ...this.runtime, adminToken: token, baseUrl: url })
      await new Promise<void>((resolve, reject) => {
        this.server!.once('error', reject)
        this.server!.listen(port, '0.0.0.0', resolve)
      })
      this.address = url
      this.token = token
      return { url, token, libraryId: library.id }
    } catch (error) {
      return { errorMessage: (error as Error).message }
    }
  }
}
export const staticServerManager = new StaticServerManager()
