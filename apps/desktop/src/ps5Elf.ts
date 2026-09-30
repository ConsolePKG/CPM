import { Socket } from 'node:net'

export function sendPS5Elf({ host, port, bytes }: { host: string; port: number; bytes: Uint8Array }): Promise<void> {
  if (
    !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) ||
    host.split('.').some((part) => Number(part) > 255) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    bytes.length < 4 ||
    bytes.length > 64 * 1024 * 1024 ||
    bytes[0] !== 0x7f ||
    bytes[1] !== 0x45 ||
    bytes[2] !== 0x4c ||
    bytes[3] !== 0x46
  )
    return Promise.reject(new Error('PS5 ELF 目标或文件无效'))
  return new Promise((resolve, reject) => {
    const socket = new Socket()
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      socket.destroy()
      if (error) reject(error)
      else resolve()
    }
    socket.setTimeout(15000, () => finish(new Error('PS5 ELF loader 超时')))
    socket.once('error', finish)
    socket.once('connect', () => socket.end(Buffer.from(bytes)))
    socket.once('finish', () => finish())
    socket.connect(port, host)
  })
}
