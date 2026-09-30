import { getPs4PkgInfo } from '@njzy/ps4-pkg-info/web'

self.onmessage = async (event: MessageEvent<{ id: number; url: string }>) => {
  const { id, url } = event.data
  if (typeof fetch !== 'function') {
    self.postMessage({ id, workerUnavailable: true })
    return
  }
  try {
    const info = await getPs4PkgInfo(url)
    self.postMessage({ id, info })
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) })
  }
}
