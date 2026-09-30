import { packageParser } from './parser'

const pending = new Map<number, { resolve: (bytes: Uint8Array) => void; reject: (error: Error) => void }>()
let sequence = 0
self.onmessage = async ({ data }) => {
  if (data.type === 'read-result') {
    const request = pending.get(data.id)
    pending.delete(data.id)
    data.error ? request?.reject(new Error(data.error)) : request?.resolve(data.bytes)
    return
  }
  if (data.type !== 'execute') return
  const reader = {
    readRange: (offset: number, length: number) =>
      new Promise<Uint8Array>((resolve, reject) => {
        const id = ++sequence
        pending.set(id, { resolve, reject })
        self.postMessage({ type: 'read', id, offset, length })
      }),
  }
  try {
    const result =
      data.operation === 'parse'
        ? await packageParser.parse(reader)
        : await packageParser.asset!(reader, data.kind, data.key)
    self.postMessage({ result })
  } catch (error) {
    self.postMessage({ error: (error as Error).message })
  }
}
