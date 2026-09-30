import { parentPort } from 'node:worker_threads'
import { packageParser } from '../parser'
import type { ByteReader } from '../types'

if (!parentPort) throw new Error('Library parser must run in a worker thread')
const port = parentPort
const pending = new Map<number, { resolve: (bytes: Uint8Array) => void; reject: (error: Error) => void }>()
let sequence = 0
const reader: ByteReader = {
  readRange: (offset, length) =>
    new Promise((resolve, reject) => {
      const id = ++sequence
      pending.set(id, { resolve, reject })
      port.postMessage({ type: 'read', id, offset, length })
    }),
}
port.on('message', async (data) => {
  if (data.type === 'read-result') {
    const request = pending.get(data.id)
    pending.delete(data.id)
    data.error ? request?.reject(new Error(data.error)) : request?.resolve(data.bytes)
    return
  }
  try {
    const result =
      data.operation === 'parse'
        ? await packageParser.parse(reader)
        : await packageParser.asset!(reader, data.kind, data.key)
    port.postMessage({ result })
  } catch (error) {
    port.postMessage({ error: (error as Error).message })
  }
})
port.postMessage({ type: 'ready' })
