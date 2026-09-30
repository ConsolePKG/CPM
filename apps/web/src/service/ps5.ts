import axios from 'axios'

export type PS5InstallResponse = {
  status: 'success' | 'fail'
  content_id?: string
  install_state?: string
  error?: string
  error_code?: number
}

export type PS5ProgressResponse = {
  status: 'success' | 'fail'
  content_id?: string
  install_state?: string
  downloaded_size?: number
  total_size?: number
  promote_progress?: number
  local_copy_percent?: number
  install_error?: number
  error_code?: number
  error?: string
}

export async function installPS5(host: string, url: string, title?: string, iconUrl?: string) {
  const { data } = await axios.post<PS5InstallResponse>(
    `${host}/api/install`,
    {
      url,
      ...(title ? { title } : {}),
      ...(iconUrl ? { icon_url: iconUrl } : {}),
    },
    { timeout: 30000 },
  )
  if (data.status !== 'success' || !data.content_id)
    throw new Error(data.error || `PS5 安装失败：${data.error_code ?? '未知错误'}`)
  return data
}

export async function uploadPS5Icon(host: string, contentId: string, source: string | Uint8Array): Promise<string> {
  let bytes: ArrayBuffer
  if (typeof source === 'string') {
    const image = await fetch(source)
    if (!image.ok) throw new Error('无法读取包封面')
    bytes = await image.arrayBuffer()
  } else bytes = Uint8Array.from(source).buffer
  const magic = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 8))
  if (bytes.byteLength < 8 || bytes.byteLength > 2 * 1024 * 1024 || magic.join(',') !== '137,80,78,71,13,10,26,10')
    throw new Error('包封面不是有效 PNG')
  if (window.electron?.servePS5Icon)
    return window.electron.servePS5Icon({ host: new URL(host).hostname, bytes: new Uint8Array(bytes) })
  const target = `${host}/api/icon/${encodeURIComponent(contentId)}`
  await axios.post(target, bytes, { headers: { 'Content-Type': 'image/png' }, timeout: 15000 })
  return target
}

export async function progressPS5(host: string, contentId: string) {
  const { data } = await axios.post<PS5ProgressResponse>(
    `${host}/api/get_task_progress`,
    { content_id: contentId },
    { timeout: 10000 },
  )
  if (data.status !== 'success') throw new Error(data.error || `PS5 进度读取失败：${data.error_code ?? '未知错误'}`)
  return data
}
