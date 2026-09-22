import { Buffer } from 'buffer'
import type { CustomSeek } from '../core'
import type { ResourceOptions } from '../resources'

/** Bounded range-only reader: never download a whole game when Range is ignored. */
export function createResourceReader(url: string, options: ResourceOptions = {}): CustomSeek {
  const target = new URL(url)
  const authorization = target.username
    ? 'Basic ' +
      Buffer.from(`${decodeURIComponent(target.username)}:${decodeURIComponent(target.password)}`).toString('base64')
    : undefined
  target.username = ''
  target.password = ''
  target.hash = ''
  const controller = new AbortController()
  const abort = () => controller.abort()
  options.signal?.addEventListener('abort', abort, { once: true })
  if (options.signal?.aborted) abort()
  return {
    async seekChunk(start, end = start + 65535) {
      const timer = setTimeout(abort, 20000)
      try {
        const headers: Record<string, string> = { Range: `bytes=${start}-${end}` }
        if (authorization) headers.Authorization = authorization
        const response = await fetch(target.href, { headers, signal: controller.signal })
        if (response.status !== 206) {
          await response.body?.cancel()
          throw new Error(
            response.status === 200 ? '文件服务器未支持 Range 分段读取' : `资源读取失败（HTTP ${response.status}）`,
          )
        }
        const range = response.headers.get('Content-Range')
        if (range && !range.startsWith(`bytes ${start}-${end}/`)) {
          await response.body?.cancel()
          throw new Error('文件服务器返回了错误的数据范围')
        }
        const expected = end - start + 1
        const reader = response.body?.getReader?.()
        if (!reader) {
          // Older WebKit can fetch binary responses without exposing body streams.
          // Only accept partial responses; never buffer a server's full PKG response.
          const length = response.headers.get('Content-Length')
          if (length !== null && Number(length) !== expected) throw new Error('资源数据长度与请求范围不符')
          const bytes = Buffer.from(await response.arrayBuffer())
          if (bytes.length !== expected) throw new Error('资源数据不完整')
          return bytes
        }
        const chunks: Uint8Array[] = []
        let size = 0
        try {
          for (;;) {
            const { value, done } = await reader.read()
            if (done) break
            size += value.length
            if (size > expected) throw new Error('文件服务器返回的资源超出请求范围')
            chunks.push(value)
          }
        } finally {
          await reader.cancel()
          reader.releaseLock()
        }
        if (size !== expected) throw new Error('资源数据不完整')
        return Buffer.concat(chunks, size)
      } finally {
        clearTimeout(timer)
      }
    },
    destroyAll() {
      abort()
      options.signal?.removeEventListener('abort', abort)
    },
  }
}
