import fs from 'fs'

import type { CustomSeek, ExtractOptions, Ps4PkgInfo } from '../core'
import { extract } from '../core'

export * from '../types'

const createSeek = (pkgFilePath: string): CustomSeek => {
  const streams: fs.ReadStream[] = []
  const seek = (offset: number, whence?: number) => {
    const stream = fs.createReadStream(pkgFilePath, {
      start: offset,
      end: whence,
    })
    streams.push(stream)
    return stream
  }
  return {
    seekChunk: async (offset: number, whence?: number) => {
      const stream = seek(offset, whence)
      let totalChunk = Buffer.from([])
      return await new Promise<Buffer>((resolve, reject) => {
        if (whence) {
          stream.on('data', (chunk: string | Buffer) => {
            totalChunk = Buffer.concat([totalChunk, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)])
          })
          stream.on('end', () => {
            resolve(totalChunk)
          })
        } else {
          stream.once('data', (chunk) => resolve(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
        }
        stream.on('error', reject)
      })
    },
    destroyAll() {
      streams.forEach((stream) => {
        stream.destroy()
      })
    },
  }
}

type Options = Pick<ExtractOptions, 'generateIcon0' | 'generateParamSfo'> & {
  /**
   * base64
   * @default false
   */
  generateBase64Icon?: boolean
}

export const getPs4PkgInfo = async (pkgFilePath: string, options?: Options): Promise<Ps4PkgInfo | undefined> => {
  const { seekChunk, destroyAll } = createSeek(pkgFilePath)
  const res = await extract({ seekChunk, destroyAll, ...options })
  if (res?.icon0Raw && options?.generateBase64Icon) {
    res.icon0 = `data:image/png;base64,` + res.icon0Raw.toString('base64')
  }
  return res
}
