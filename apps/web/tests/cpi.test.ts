import { afterEach, beforeEach, describe, expect, it, rstest } from '@rstest/core'
const mocks = rstest.hoisted(() => ({ get: rstest.fn(), post: rstest.fn() }))
rstest.mock('axios', () => ({ default: mocks }))
import { getCPIStatus, hashPayload, postGoldHEN, reinstallCPI } from '../src/service/cpi'
const bytes = new Uint8Array([127, 69, 76, 70, 1, 2, 3, 4]).buffer
const bundle = { filename: 'rpi-payload-ps4.elf', version: '2.06', size: bytes.byteLength, sha256: hashPayload(bytes) }
let stage: string, uploaded: ArrayBuffer | null, posts: string[], ready: boolean
class XHR {
  status = 200
  responseText = ''
  timeout = 0
  onload?: () => void
  onerror?: () => void
  ontimeout?: () => void
  url = ''
  open(method: string, url: string) {
    expect(method).toBe('POST')
    this.url = url
  }
  send(body: ArrayBuffer | null) {
    posts.push(this.url)
    if (this.url.endsWith('/status')) this.responseText = JSON.stringify({ status: ready ? 'ready' : 'busy' })
    else {
      uploaded = body
      stage = 'sent'
    }
    this.onload?.()
  }
}
beforeEach(() => {
  rstest.useFakeTimers()
  rstest.resetAllMocks()
  rstest.stubGlobal('XMLHttpRequest', XHR)
  stage = 'initial'
  uploaded = null
  posts = []
  ready = true
  mocks.get.mockImplementation(async (url: string) => {
    if (url.includes('manifest.json')) return { data: bundle }
    if (url.endsWith('.elf') || url.endsWith('/api/payload')) return { data: bytes }
    if (url.endsWith('/health') && stage === 'stopped') throw new Error('connection refused')
    return { status: 200, data: { status: 'success', version: '2.06', system_version: '9.00', payload_update: true } }
  })
  mocks.post.mockImplementation(async (url: string) => {
    if (url.endsWith('/api/payload')) return { status: 200, data: { status: 'success', size: bytes.byteLength } }
    stage = 'stopped'
    return { status: 202, data: { state: 'shutting_down' } }
  })
})
afterEach(() => {
  rstest.useRealTimers()
  rstest.unstubAllGlobals()
})
describe('CPI host management', () => {
  it('reads versions and preserves CPI version if firmware reading fails', async () => {
    expect(await getCPIStatus('http://ps4:12801')).toMatchObject({
      state: 'online',
      version: '2.06',
      systemVersion: '9.00',
    })
    mocks.get.mockResolvedValueOnce({ status: 503, data: { status: 'fail', version: '2.06', system_version: null } })
    expect(await getCPIStatus('http://ps4:12801')).toMatchObject({ state: 'online', version: '2.06' })
  })
  it('recognizes an older installer without inventing versions', async () => {
    mocks.get.mockResolvedValueOnce({ status: 404 })
    mocks.post.mockResolvedValueOnce({ data: { status: 'success', exists: false } })
    expect(await getCPIStatus('http://ps4:12801')).toMatchObject({ state: 'legacy' })
  })
  it('uses a raw binary HTTP POST without multipart or custom headers', async () => {
    await postGoldHEN('http://ps4:9090/', bytes)
    expect(uploaded).toBe(bytes)
  })
  it('validates before stopping, sends once, and verifies the restarted service', async () => {
    const task = reinstallCPI('http://ps4:12801', 9090, () => {})
    await rstest.advanceTimersByTimeAsync(10000)
    expect(await task).toMatchObject({ state: 'online', version: '2.06' })
    expect(posts).toEqual(['http://ps4:9090/status', 'http://ps4:9090/'])
    expect(uploaded).toBe(bytes)
    expect(mocks.post).toHaveBeenCalledWith('http://ps4:12801/api/shutdown', undefined, expect.anything())
  })
  it('never stops CPI when the bundled checksum is wrong', async () => {
    mocks.get.mockResolvedValueOnce({ data: { ...bundle, sha256: '0'.repeat(64) } })
    await expect(reinstallCPI('http://ps4:12801', 9090, () => {})).rejects.toThrow('校验失败')
    expect(mocks.post).not.toHaveBeenCalled()
    expect(posts).toEqual([])
  })
  it('never stops CPI when GoldHEN is busy', async () => {
    ready = false
    await expect(reinstallCPI('http://ps4:12801', 9090, () => {})).rejects.toThrow('未就绪')
    expect(mocks.post).not.toHaveBeenCalled()
    expect(uploaded).toBeNull()
  })
  it('does not send when shutdown is unsupported', async () => {
    mocks.post.mockImplementation(async (url: string) =>
      url.endsWith('/api/payload')
        ? { status: 200, data: { status: 'success', size: bytes.byteLength } }
        : { status: 404, data: {} },
    )
    await expect(reinstallCPI('http://ps4:12801', 9090, () => {})).rejects.toThrow('未接受退出')
    expect(uploaded).toBeNull()
  })
  it('does not send while the old listeners are still online', async () => {
    mocks.post.mockImplementation(async (url: string) =>
      url.endsWith('/api/payload')
        ? { status: 200, data: { status: 'success', size: bytes.byteLength } }
        : { status: 202, data: { state: 'shutting_down' } },
    )
    const result = reinstallCPI('http://ps4:12801', 9090, () => {}).catch((error) => error)
    await rstest.advanceTimersByTimeAsync(20000)
    expect((await result).message).toContain('尚未退出')
    expect(uploaded).toBeNull()
  })
  it('never repeats a payload upload when the service does not come back', async () => {
    mocks.get.mockImplementation(async (url: string) => {
      if (url.includes('manifest.json')) return { data: bundle }
      if (url.endsWith('.elf') || url.endsWith('/api/payload')) return { data: bytes }
      if (stage !== 'initial') throw new Error('offline')
      return { status: 200, data: { status: 'success', version: '2.06' } }
    })
    const result = reinstallCPI('http://ps4:12801', 9090, () => {}).catch((error) => error)
    await rstest.advanceTimersByTimeAsync(30000)
    expect((await result).message).toContain('未确认 CPI 上线')
    expect(posts.filter((url) => url === 'http://ps4:9090/')).toHaveLength(1)
  })
  it('updates and verifies the boot file before shutting down capable CPI', async () => {
    const task = reinstallCPI('http://ps4:12801', 9090, () => {})
    await rstest.advanceTimersByTimeAsync(10000)
    await task
    expect(mocks.post.mock.calls.map((call) => call[0])).toEqual([
      'http://ps4:12801/api/payload',
      'http://ps4:12801/api/shutdown',
    ])
    expect(mocks.get).toHaveBeenCalledWith(
      'http://ps4:12801/api/payload',
      expect.objectContaining({ responseType: 'arraybuffer' }),
    )
  })
  it('bootstraps an older CPI and persists the file using the new instance', async () => {
    mocks.get.mockImplementation(async (url: string) => {
      if (url.includes('manifest.json')) return { data: bundle }
      if (url.endsWith('.elf') || url.endsWith('/api/payload')) return { data: bytes }
      if (url.endsWith('/health') && stage === 'stopped') throw new Error('offline')
      return { status: 200, data: { status: 'success', version: '2.06', payload_update: stage === 'sent' } }
    })
    const task = reinstallCPI('http://ps4:12801', 9090, () => {})
    await rstest.advanceTimersByTimeAsync(10000)
    await task
    expect(mocks.post.mock.calls.map((call) => call[0])).toEqual([
      'http://ps4:12801/api/shutdown',
      'http://ps4:12801/api/payload',
    ])
  })
  it('leaves the running service alone if boot-file readback differs', async () => {
    mocks.get.mockImplementation(async (url: string) => {
      if (url.includes('manifest.json')) return { data: bundle }
      if (url.endsWith('.elf')) return { data: bytes }
      if (url.endsWith('/api/payload')) return { data: new Uint8Array([1, 2]).buffer }
      return { status: 200, data: { status: 'success', version: '2.06', payload_update: true } }
    })
    await expect(reinstallCPI('http://ps4:12801', 9090, () => {})).rejects.toThrow('回读校验失败')
    expect(mocks.post.mock.calls.map((call) => call[0])).toEqual(['http://ps4:12801/api/payload'])
    expect(uploaded).toBeNull()
  })
})
