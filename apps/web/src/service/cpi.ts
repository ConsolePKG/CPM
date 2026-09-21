import axios from 'axios'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'
export const hashPayload = (bytes: ArrayBuffer) => bytesToHex(sha256(new Uint8Array(bytes)))

export type CPIStatus = {
  state: 'online' | 'legacy' | 'offline'
  version?: string
  payloadUpdate?: boolean
  systemVersion?: string
  message?: string
}
export type CPIBundle = { version: string; filename: string; size: number; sha256: string }
export async function getCPIStatus(host: string, signal?: AbortSignal): Promise<CPIStatus> {
  try {
    const { status, data } = await axios.get(`${host}/api/status`, {
      timeout: 3000,
      signal,
      validateStatus: () => true,
    })
    if ((status === 200 && data?.status === 'success') || (status === 503 && data?.status === 'fail')) {
      if (typeof data.version === 'string')
        return {
          state: 'online',
          version: data.version,
          payloadUpdate: data.payload_update === true,
          systemVersion: typeof data.system_version === 'string' ? data.system_version : undefined,
          message: status === 503 ? 'CPI 在线，但系统版本读取失败' : undefined,
        }
    }
    if (status !== 404) return { state: 'offline', message: 'CPI 状态响应异常' }
    const legacy = await axios.post(`${host}/api/is_exists`, { title_id: 'CUSA00000' }, { timeout: 3000, signal })
    if (legacy.data?.status === 'success' && typeof legacy.data.exists === 'boolean') {
      return { state: 'legacy', message: '安装服务在线，旧版不支持版本查询' }
    }
  } catch (error) {
    if (signal?.aborted) throw error
  }
  return { state: 'offline', message: 'CPI 未连接，请检查主机、端口及服务；网页也可能受浏览器网络限制' }
}
export async function getCPIBundle(): Promise<CPIBundle> {
  const { data } = await axios.get<CPIBundle>('./cpi/manifest.json', { timeout: 5000, params: { t: Date.now() } })
  if (!data?.version || data.filename !== 'rpi-payload-ps4.elf' || !/^[a-f0-9]{64}$/.test(data.sha256)) {
    throw new Error('内置 CPI 文件信息无效')
  }
  return data
}

// GoldHEN HTTP sender reference:
// https://github.com/hippie68/hippie68.github.io/blob/master/900/index.html
// POST /status; POST / with raw ArrayBuffer (no multipart or custom headers).
export function postGoldHEN(url: string, body?: ArrayBuffer): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.timeout = 15000
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText })
    xhr.onerror = () =>
      reject(new Error('无法访问 GoldHEN：请检查 Payload Server、浏览器本地网络权限及 HTTP/HTTPS 限制'))
    xhr.ontimeout = () => reject(new Error('GoldHEN 请求超时'))
    xhr.send(body ?? null)
  })
}
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const activeReinstalls = new Set<string>()
export async function reinstallCPI(
  host: string,
  loaderPort: number,
  update: (message: string) => void,
): Promise<CPIStatus> {
  const target = new URL(host)
  if (
    target.protocol !== 'http:' ||
    target.username ||
    target.password ||
    target.pathname !== '/' ||
    target.search ||
    target.hash
  ) {
    throw new Error('主机地址无效')
  }
  if (!Number.isInteger(loaderPort) || loaderPort < 1 || loaderPort > 65535) throw new Error('Payload Server 端口无效')
  if (!window.electron && location.protocol === 'https:')
    throw new Error('请通过 HTTP 打开 CPM，或使用 Electron，浏览器会阻止 HTTPS 页面访问主机 HTTP 服务')
  if (activeReinstalls.has(target.hostname)) throw new Error('此主机正在重装 CPI')
  activeReinstalls.add(target.hostname)
  try {
    update('正在校验内置 ELF…')
    const manifest = await getCPIBundle()
    const { data: bytes } = await axios.get<ArrayBuffer>('./cpi/rpi-payload-ps4.elf', {
      responseType: 'arraybuffer',
      timeout: 15000,
    })
    if (
      !(bytes instanceof ArrayBuffer) ||
      bytes.byteLength !== manifest.size ||
      new Uint8Array(bytes, 0, 4).join(',') !== '127,69,76,70' ||
      hashPayload(bytes) !== manifest.sha256
    ) {
      throw new Error('内置 ELF 校验失败，尚未停止 CPI')
    }
    const loader = new URL(target.origin)
    loader.port = String(loaderPort)
    update('正在检查 GoldHEN Payload Server…')
    const ready = await postGoldHEN(`${loader.origin}/status`)
    let state: string | undefined
    try {
      state = JSON.parse(ready.text).status
    } catch {
      /* Invalid responses are not readiness. */
    }
    if (ready.status !== 200 || state !== 'ready') throw new Error('GoldHEN Payload Server 未就绪，请开启服务后重试')
    const persist = async (origin: string) => {
      update('正在更新 /data/payloads 中的启动文件…')
      const response = await axios.post(`${origin}/api/payload`, bytes, {
        timeout: 15000,
        headers: { 'Content-Type': 'application/octet-stream' },
      })
      if (response.data?.status !== 'success' || response.data?.size !== bytes.byteLength) {
        throw new Error('CPI 启动文件更新失败')
      }
      const saved = await axios.get<ArrayBuffer>(`${origin}/api/payload`, {
        responseType: 'arraybuffer',
        timeout: 15000,
        params: { t: Date.now() },
      })
      if (!(saved.data instanceof ArrayBuffer) || hashPayload(saved.data) !== manifest.sha256) {
        throw new Error('启动文件回读校验失败，未确认更新完成')
      }
    }
    let persisted = false
    const before = await getCPIStatus(target.origin)
    if (before.payloadUpdate) {
      await persist(target.origin)
      persisted = true
    }
    if (before.state === 'legacy') throw new Error('旧版 CPI 无法确认退出能力，请先在主机退出旧服务后重试')
    if (before.state === 'online') {
      update('正在退出当前 CPI…')
      const stopped = await axios.post(`${target.origin}/api/shutdown`, undefined, { timeout: 5000 })
      if (stopped.status !== 202 || stopped.data?.state !== 'shutting_down')
        throw new Error('CPI 未接受退出请求，未发送 ELF')
      let offline = false
      for (let i = 0; i < 20; i++) {
        await delay(500)
        const manifestServer = new URL(target.origin)
        manifestServer.port = '12802'
        const listeners = await Promise.all(
          [target.origin, manifestServer.origin].map(async (origin) => {
            try {
              await axios.get(`${origin}/api/health`, { timeout: 1000, validateStatus: () => true })
              return true
            } catch {
              return false
            }
          }),
        )
        if (listeners.every((online) => !online)) {
          offline = true
          break
        }
      }
      if (!offline) throw new Error('旧 CPI 尚未退出，未发送 ELF')
      // Allow the manifest listener and platform cleanup to finish as well.
      await delay(2000)
    }
    update('正在发送内置 ELF…')
    let sendError: unknown
    try {
      const result = await postGoldHEN(`${loader.origin}/`, bytes)
      if (result.status < 200 || result.status >= 300) sendError = new Error(`GoldHEN 返回 HTTP ${result.status}`)
    } catch (error) {
      sendError = error
    }
    // Some loaders close HTTP while starting the payload. Never retry the upload;
    // check CPI separately instead of claiming success from an opaque response.
    update('正在等待 CPI 重新上线…')
    const cpi = new URL(target.origin)
    cpi.port = '12801' // Bundled standalone payload always listens here.
    for (let i = 0; i < 15; i++) {
      await delay(1000)
      const status = await getCPIStatus(cpi.origin)
      if (status.state === 'online' && status.version === manifest.version) {
        if (!persisted) {
          if (!status.payloadUpdate) throw new Error('CPI 已上线，但不支持保存启动文件，请更新内置 ELF')
          await persist(cpi.origin)
        }
        return status
      }
    }
    throw new Error(
      `ELF 已尝试发送，但未确认 CPI 上线，请在主机检查。${sendError instanceof Error ? sendError.message : ''}`,
    )
  } finally {
    activeReinstalls.delete(target.hostname)
  }
}
