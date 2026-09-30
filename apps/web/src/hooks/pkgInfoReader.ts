import type { Ps4PkgParamSfo } from '@njzy/ps4-pkg-info/web'
import { isPlayStationBrowser } from '@/utils/browser'
import { recordLibraryDiagnostics } from '@/utils/libraryDiagnostics'

type Ps4PkgInfo = { paramSfo?: Ps4PkgParamSfo; icon0Raw?: Uint8Array } | undefined
type Pending = { resolve: (value: Ps4PkgInfo) => void; reject: (reason: Error) => void; url: string }
let worker: Worker | undefined
let workerUnavailable = false
let fallbackReason = ''
let workerResponded = false
let workerReportedError = false
let nextId = 0
const pending = new Map<number, Pending>()

async function readOnMainThread(url: string): Promise<Ps4PkgInfo> {
  const { getPs4PkgInfo } = await import('@njzy/ps4-pkg-info/web')
  return getPs4PkgInfo(url)
}

function fallBackToMainThread(reason: string, current?: Pending) {
  worker?.terminate()
  worker = undefined
  workerUnavailable = true
  fallbackReason = reason
  recordLibraryDiagnostics({ readerMode: 'main', readerReason: reason })
  if (current) void readOnMainThread(current.url).then(current.resolve, current.reject)
  for (const request of pending.values()) {
    void readOnMainThread(request.url).then(request.resolve, request.reject)
  }
  pending.clear()
}

export function beginLibraryPkgScan() {
  if (!isPlayStationBrowser) return
  workerResponded = false
  workerReportedError = false
  recordLibraryDiagnostics({
    readerMode: workerUnavailable ? 'main' : worker ? 'worker-started' : 'waiting',
    readerReason: fallbackReason,
  })
}

function getWorker(): Worker | undefined {
  if (!isPlayStationBrowser || workerUnavailable) return
  if (typeof Worker === 'undefined') {
    workerUnavailable = true
    fallbackReason = '此浏览器未提供 Worker'
    recordLibraryDiagnostics({ readerMode: 'main', readerReason: fallbackReason })
    return
  }
  if (worker) return worker
  try {
    worker = new Worker(new URL('./pkgInfo.worker.ts', import.meta.url))
    recordLibraryDiagnostics({ readerMode: 'worker-started', readerReason: '' })
    worker.onmessage = (
      event: MessageEvent<{ id: number; info?: Ps4PkgInfo; error?: string; workerUnavailable?: boolean }>,
    ) => {
      const request = pending.get(event.data.id)
      if (!request) return
      pending.delete(event.data.id)
      if (event.data.workerUnavailable) {
        fallBackToMainThread('Worker 内没有 fetch', request)
      } else {
        if (event.data.error) {
          if (!workerResponded && !workerReportedError) {
            workerReportedError = true
            recordLibraryDiagnostics({ readerMode: 'worker-error', readerReason: event.data.error.slice(0, 160) })
          }
          request.reject(new Error(event.data.error))
        } else {
          if (!workerResponded) {
            workerResponded = true
            recordLibraryDiagnostics({ readerMode: 'worker', readerReason: '' })
          }
          request.resolve(event.data.info)
        }
      }
    }
    worker.onerror = () => {
      fallBackToMainThread('Worker 脚本加载或运行失败')
    }
    return worker
  } catch {
    workerUnavailable = true
    fallbackReason = 'Worker 创建失败'
    recordLibraryDiagnostics({ readerMode: 'main', readerReason: fallbackReason })
  }
}

export function getLibraryPkgInfo(url: string): Promise<Ps4PkgInfo | undefined> {
  const reader = getWorker()
  if (!reader) return readOnMainThread(url)
  return new Promise((resolve, reject) => {
    const id = ++nextId
    pending.set(id, { resolve, reject, url })
    try {
      reader.postMessage({ id, url })
    } catch {
      fallBackToMainThread('无法向 Worker 发送消息')
    }
  })
}
