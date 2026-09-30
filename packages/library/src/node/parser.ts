import { Worker } from 'node:worker_threads'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { packageParser } from '../parser'
import type { ByteReader, PackageParser } from '../types'
import { boundedSignal } from '../abort'

export function nodeWorkerParser(createWorker?: () => Worker): PackageParser {
  const moduleBase = import.meta.url
  const module = new URL('../parser.ts', moduleBase)
  const supported = !!createWorker || existsSync(fileURLToPath(module))
  const execute = async (reader: ByteReader, operation: string, kind?: string, key?: string, signal?: AbortSignal) => {
    if (!supported)
      return operation === 'parse' ? packageParser.parse(reader, signal) : packageParser.asset!(reader, kind!, key)
    const worker = createWorker
      ? createWorker()
      : new Worker(
          `
      (async () => {
        const { parentPort, workerData } = await import('node:worker_threads');
        try {
        const { createRequire } = await import('node:module');
        createRequire(workerData.module)('tsx/cjs/api').register();
        const { register } = await import('tsx/esm/api'); register();
        const { packageParser } = await import(workerData.module);
        const pending = new Map(); let sequence = 0;
        const reader = { readRange: (offset, length) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); parentPort.postMessage({ type: 'read', id, offset, length }); }) };
        parentPort.on('message', async (data) => {
          if (data.type === 'read-result') { const request = pending.get(data.id); pending.delete(data.id); data.error ? request.reject(new Error(data.error)) : request.resolve(data.bytes); return; }
          try { const result = data.operation === 'parse' ? await packageParser.parse(reader) : await packageParser.asset(reader, data.kind, data.key); parentPort.postMessage({ result }); } catch (error) { parentPort.postMessage({ error: error.message }); }
        }); parentPort.postMessage({ type: 'ready' });
        } catch (error) { parentPort.postMessage({ error: error.message }); }
      })();
    `,
          { eval: true, workerData: { module: module.href } },
        )
    const bounded = boundedSignal(signal, 120000)
    return new Promise<any>((resolve, reject) => {
      let settled = false
      const finish = (error?: Error, result?: unknown) => {
        if (settled) return
        settled = true
        bounded.dispose()
        bounded.signal.removeEventListener('abort', onAbort)
        void worker.terminate()
        error ? reject(error) : resolve(result)
      }
      const onAbort = () => finish(new Error('Parser worker aborted or timed out'))
      bounded.signal.addEventListener('abort', onAbort, { once: true })
      if (bounded.signal.aborted) {
        onAbort()
        return
      }
      worker.on('error', finish)
      worker.on('exit', (code) => {
        if (!settled) finish(new Error(`Parser worker exited: ${code}`))
      })
      worker.on('message', async (data) => {
        if (data.type === 'ready') worker.postMessage({ operation, kind, key })
        else if (data.type === 'read') {
          try {
            const bytes = await reader.readRange(data.offset, data.length, bounded.signal)
            if (!settled) worker.postMessage({ type: 'read-result', id: data.id, bytes })
          } catch (error) {
            if (!settled) worker.postMessage({ type: 'read-result', id: data.id, error: (error as Error).message })
          }
        } else finish(data.error ? new Error(data.error) : undefined, data.result)
      })
    })
  }
  return {
    version: packageParser.version,
    parse: (reader, signal) => execute(reader, 'parse', undefined, undefined, signal),
    asset: (reader, kind, key) => execute(reader, 'asset', kind, key),
  }
}
