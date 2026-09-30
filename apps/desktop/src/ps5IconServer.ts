import { createSocket } from 'node:dgram'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'

const icons = new Map<string, Buffer>()
let opening: Promise<number> | undefined

function localAddressFor(host: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = createSocket('udp4')
    socket.once('error', (error) => {
      socket.close()
      reject(error)
    })
    socket.connect(9, host, () => {
      const address = socket.address().address
      socket.close()
      resolve(address)
    })
  })
}

function startServer(): Promise<number> {
  if (opening) return opening
  opening = new Promise((resolve, reject) => {
    const next = createServer((request, response) => {
      const token = /^\/icon\/([a-f0-9]{32})$/.exec(request.url || '')?.[1]
      const icon = token && icons.get(token)
      if (request.method !== 'GET' || !icon) {
        response.writeHead(404).end()
        return
      }
      response
        .writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Length': icon.length,
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*',
        })
        .end(icon)
    })
    next.once('error', (error) => {
      opening = undefined
      reject(error)
    })
    next.listen(0, '0.0.0.0', () => {
      resolve((next.address() as { port: number }).port)
    })
  })
  return opening
}

export async function servePS5Icon({ host, bytes }: { host: string; bytes: Uint8Array }): Promise<string> {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.split('.').some((part) => Number(part) > 255))
    throw new Error('PS5 主机 IP 无效')
  const icon = Buffer.from(bytes)
  if (
    icon.length < 8 ||
    icon.length > 2 * 1024 * 1024 ||
    !icon.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    throw new Error('包封面不是有效 PNG')
  const [port, address] = await Promise.all([startServer(), localAddressFor(host)])
  const token = randomBytes(16).toString('hex')
  icons.set(token, icon)
  while (icons.size > 16) icons.delete(icons.keys().next().value!)
  return `http://${address}:${port}/icon/${token}`
}
