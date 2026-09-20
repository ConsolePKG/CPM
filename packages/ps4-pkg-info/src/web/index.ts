import { Buffer } from 'buffer'

import type { CustomSeek, ExtractOptions, Ps4PkgInfo } from '../core'
import { extract } from '../core'

export * from '../types'

const createSeek = (url: string): CustomSeek => {
  let streams: globalThis.ReadableStream<Uint8Array>[] = []
  const { origin, pathname, username, password } = new URL(url)
  const seek = async (offset: number, whence?: number) => {
    const headers = new Headers()
    headers.append('Range', `bytes=${offset}-${whence || offset + 64 * 1024}`)
    username &&
      password &&
      headers.append(
        'Authorization',
        'Basic ' + Buffer.from(decodeURIComponent(username) + ':' + decodeURIComponent(password)).toString('base64'),
      )
    const res = await window.fetch(origin + pathname, {
      headers,
    })
    const stream = res.body
    stream && streams.push(stream)
    return stream
  }
  return {
    seekChunk: async (offset: number, whence?: number) => {
      const stream = await seek(offset, whence)
      const reader = stream?.getReader()
      if (!reader) {
        return Buffer.from([])
      }
      let totalChunk = Buffer.from([])
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          break
        }
        totalChunk = Buffer.concat([totalChunk, value])
      }
      reader.releaseLock()
      return totalChunk
    },
    destroyAll: () => {
      streams = []
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

export const getPs4PkgInfo = async (pkgFileUrl: string, options?: Options): Promise<Ps4PkgInfo | undefined> => {
  const { seekChunk, destroyAll } = createSeek(pkgFileUrl)
  const res = await extract({ seekChunk, destroyAll, ...options })
  if (res?.icon0Raw && options?.generateBase64Icon) {
    res.icon0 = `data:image/png;base64,` + res.icon0Raw.toString('base64')
  }
  return res
}
