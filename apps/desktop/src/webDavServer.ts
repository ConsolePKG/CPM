import { v2 as webdav } from 'webdav-server'

class WebDavServerManager {
  private static instance: WebDavServerManager

  static getInstance() {
    if (!WebDavServerManager.instance) {
      WebDavServerManager.instance = new WebDavServerManager()
    }
    return WebDavServerManager.instance
  }

  server?: webdav.WebDAVServer

  async create({ directoryPath, port }: { directoryPath: string; port: number }) {
    const server = new webdav.WebDAVServer({
      requireAuthentification: false,
    })
    if (this.server) {
      await this.server.stopAsync()
    }
    const isSetFileSystemSuccess = await server.setFileSystemAsync('/', new webdav.PhysicalFileSystem(directoryPath))
    if (!isSetFileSystemSuccess) {
      throw new Error('Failed to set file system')
    }
    const handleError = (err: Error) => {
      // @ts-ignore
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is in use`)
        return
      }
      console.error(`Failed to start: ${err.message}`)
      throw new Error(`Failed to start: ${err.message}`)
    }
    process.on('uncaughtException', handleError)
    const httpServer = await server.startAsync(port)
    if (httpServer) {
      process.removeAllListeners('uncaughtException')
      this.server = server
      return true
    } else {
      throw new Error('Failed to start')
    }
  }
}

export const webDavServerManager = WebDavServerManager.getInstance()
