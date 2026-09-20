export function validateConsoleAddress(input: string): { url?: string; error?: string } {
  const address = input
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '')
  if (!address) return { error: '请输入 PS4 IP 与端口' }
  try {
    const url = new URL(`http://${address}`)
    if (!url.hostname || !url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
      return { error: '请输入有效的主机地址和端口，例如 192.168.1.108:12801' }
    return { url: `http://${address}` }
  } catch {
    return { error: '主机地址或端口无效' }
  }
}
export function validateServerUrl(input: string): string | undefined {
  try {
    const url = new URL(input)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password)
      return '请输入有效的 HTTP / HTTPS 服务器地址'
  } catch {
    return '请输入有效的服务器地址'
  }
}
