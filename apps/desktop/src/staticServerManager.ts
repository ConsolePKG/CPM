import { getPs4PkgInfo, Ps4PkgParamSfo } from '@njzy/ps4-pkg-info'
import contentDisposition from 'content-disposition'
import fs from 'fs-extra'
import getFolderSize from 'get-folder-size'
import { globSync } from 'glob'
import http from 'http'
import path from 'path'
import serveStatic from 'serve-static'

import { getIp } from './utils'

type FileItem = {
  filename: string
  basename: string
  path: string
  type?: 'directory' | 'file'
  size?: number
  lastmod: Date
  isSymbolicLink: boolean
  icon0?: string
  paramSfo?: Ps4PkgParamSfo
}

class StaticServerManager {
  private static instance: StaticServerManager

  static getInstance() {
    if (!StaticServerManager.instance) {
      StaticServerManager.instance = new StaticServerManager()
    }
    return StaticServerManager.instance
  }

  server: http.Server
  port?: number
  directoryPath?: string

  serve?: any

  constructor() {
    this.server = http.createServer()
  }

  async createServer({
    directoryPath,
    port,
  }: {
    directoryPath: string
    port: number
  }): Promise<{ url?: string; errorMessage?: string }> {
    try {
      if (this.server.listening) {
        await new Promise((resolve, reject) => {
          this.server.close((err) => {
            if (err) {
              reject(err)
            } else {
              resolve(true)
            }
          })
        })
        this.server = http.createServer()
        this.directoryPath = undefined
      }

      return await new Promise<{
        url?: string
        errorMessage?: string
      }>((resolve, reject) => {
        const targetServeDirectoryPath = path.join(directoryPath)
        this.serve = serveStatic(targetServeDirectoryPath, {
          index: false,
          setHeaders: this.setDownloadHeaders,
        })

        this.server.on('request', (req, res) => {
          const { url } = req
          if (url?.startsWith('/api')) {
            this.handleApiRequest(req, res)
          } else {
            if (this.serve) {
              this.serve(req, res, () => {
                res.statusCode = 200
                return res.end()
              })
            } else {
              res.statusCode = 404
              return res.end()
            }
          }
        })

        this.server.on('error', (err: Error & { code?: string }) => {
          if (err?.code === 'EADDRINUSE') {
            reject(`Port ${port} is already in use.`)
            return
          }
          reject(err)
        })

        this.server.listen(port, '0.0.0.0', () => {
          this.directoryPath = targetServeDirectoryPath
          this.port = port
          const ip = getIp()
          console.log(`Static server is running at http://${ip}:${port}`)
          resolve({
            url: ip ? `http://${ip}:${port}` : undefined,
          })
        })
      })
    } catch (err) {
      console.error(`Failed to create server: ${err}`)
      return {
        errorMessage: (err as Error).message,
      }
    }
  }

  setDownloadHeaders(res: http.ServerResponse, path: string) {
    res.setHeader('Content-Disposition', contentDisposition(path))
  }

  setCorsHeaders(res: http.ServerResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
  }

  async handleApiRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      const { url, headers } = req
      this.setCorsHeaders(res)
      if (url?.startsWith('/api/files')) {
        const { searchParams } = new URL(url, `http://${headers.host}`)
        const paramsPath = path.join('/', searchParams?.get('path') || '/', '/')
        const recursiveQuery = searchParams?.get('recursiveQuery') === 'true'

        if (!this.directoryPath) {
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          return res.end(
            JSON.stringify({
              error: 'DirectoryPath is not found.',
            }),
          )
        }

        const fileBasePath = path.join(this.directoryPath, paramsPath)
        const files = recursiveQuery
          ? globSync('**/*.pkg', { cwd: fileBasePath, stat: true })
          : await fs.readdir(fileBasePath, { withFileTypes: true })
        const fileListPromises = files.map(async (file) => {
          const fileName = recursiveQuery ? file : file.name
          const fileType = recursiveQuery
            ? 'file'
            : file.isDirectory()
              ? 'directory'
              : file.isFile()
                ? 'file'
                : undefined
          const isSymbolicLink = recursiveQuery ? false : file.isSymbolicLink()
          const filePath = path.join(fileBasePath, fileName)
          const fileInfo = await fs.statSync(fileBasePath + fileName)
          const fileSize = fileType === 'directory' ? (await getFolderSize(filePath, { fs }))?.size : fileInfo.size
          const fileItem: FileItem = {
            filename: path.join(paramsPath, fileName),
            basename: fileName,
            path: filePath,
            type: fileType,
            size: fileSize,
            lastmod: fileInfo.mtime,
            isSymbolicLink,
          }
          if (fileType === 'file' && fileName.endsWith('.pkg')) {
            try {
              const res = await getPs4PkgInfo(filePath, { generateBase64Icon: true })
              if (res) {
                Object.assign<FileItem, Partial<FileItem>>(fileItem, { icon0: res.icon0, paramSfo: res.paramSfo })
              }
            } catch (err) {
              console.error(err)
            }
          }
          return fileItem
        })
        const fileList = (await Promise.all(fileListPromises))?.filter((item) => item.type) || []
        console.log(fileList)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify(fileList))
      } else {
        res.statusCode = 404
        return res.end()
      }
    } catch (err) {
      console.error(`Failed to handle api request: ${err}`)
      res.statusCode = 500
      return res.end((err as Error).message)
    }
  }
}

export const staticServerManager = StaticServerManager.getInstance()
