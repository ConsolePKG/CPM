import { createSocket } from 'node:dgram'
import { isIPv4 } from 'node:net'
import { networkInterfaces } from 'node:os'
import axios from 'axios'
import type { DiscoveredCPIService, DiscoveredPS4, PS4DiscoveryResult } from 'common/types'

const SEARCH = Buffer.from('SRCH * HTTP/1.1\ndevice-discovery-protocol-version:00020020\n')
const ipv4Number = (address: string) => address.split('.').reduce((value, part) => (value << 8) | Number(part), 0) >>> 0

export function broadcastAddress(address: string, netmask: string) {
  const broadcast = (ipv4Number(address) | ~ipv4Number(netmask)) >>> 0
  return [24, 16, 8, 0].map((shift) => (broadcast >>> shift) & 255).join('.')
}

export function parsePS4Response(message: string, address: string): DiscoveredPS4 | undefined {
  if (!isIPv4(address) || message.length > 8192) return
  const [status, ...lines] = message.split(/\r?\n/)
  const code = /^HTTP\/1\.1 (200|620)(?: |$)/.exec(status)?.[1]
  if (!code) return
  const headers = new Map<string, string>()
  for (const line of lines) {
    const separator = line.indexOf(':')
    if (separator > 0) headers.set(line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim())
  }
  if (headers.get('host-type') !== 'PS4' || !headers.get('host-id')) return
  return {
    id: headers.get('host-id')!,
    name: headers.get('host-name') || 'PS4',
    address,
    status: code === '200' ? 'awake' : 'standby',
    ports: [],
  }
}

function searchInterface(address: string, netmask: string): Promise<DiscoveredPS4[]> {
  return new Promise((resolve, reject) => {
    const socket = createSocket('udp4')
    const hosts = new Map<string, DiscoveredPS4>()
    let finished = false
    let retry: ReturnType<typeof setInterval> | undefined
    const finish = (error?: Error) => {
      if (finished) return
      finished = true
      clearTimeout(timeout)
      clearInterval(retry)
      try {
        socket.close()
      } catch {
        // A failed bind may leave the socket already closed.
      }
      if (error) reject(error)
      else resolve([...hosts.values()])
    }
    const timeout = setTimeout(() => finish(), 3000)
    socket.on('error', finish)
    socket.on('message', (message, remote) => {
      // 987 is the destination of SRCH; real PS4 replies use ephemeral source ports.
      if (hosts.size >= 32) return
      // Only probe responders on this interface's directly connected subnet.
      if ((ipv4Number(remote.address) & ipv4Number(netmask)) !== (ipv4Number(address) & ipv4Number(netmask))) return
      const host = parsePS4Response(message.toString('utf8'), remote.address)
      if (host) hosts.set(host.address, host)
    })
    socket.bind(0, address, () => {
      if (finished) return
      try {
        socket.setBroadcast(true)
        const send = () =>
          socket.send(SEARCH, 987, broadcastAddress(address, netmask), (error) => {
            if (error) finish(error)
          })
        send()
        retry = setInterval(send, 1000)
      } catch (error) {
        finish(error as Error)
      }
    })
  })
}

export async function probeRPIPort(address: string, port: number): Promise<boolean> {
  try {
    const response = await axios.post(
      `http://${address}:${port}/api/is_exists`,
      { title_id: 'CUSA00000' },
      {
        timeout: 1200,
        maxRedirects: 0,
        maxContentLength: 8192,
        proxy: false,
        validateStatus: () => true,
      },
    )
    // Read-only query supported by RPI; its /api root may return an empty 404.
    return response.data?.status === 'success' && typeof response.data?.exists === 'boolean'
  } catch {
    return false
  }
}

export async function probeCPIService(address: string, port: number): Promise<DiscoveredCPIService | undefined> {
  try {
    const { status, data } = await axios.get(`http://${address}:${port}/api/status`, {
      timeout: 1200,
      maxRedirects: 0,
      maxContentLength: 8192,
      proxy: false,
      validateStatus: () => true,
    })
    const validVersion = (value: unknown): value is string =>
      typeof value === 'string' && /^\d+(?:\.\d+)+$/.test(value) && value.length <= 32
    if (validVersion(data?.version)) {
      if (status === 200 && data.status === 'success' && validVersion(data.system_version)) {
        return { port, version: data.version, systemVersion: data.system_version }
      }
      // CPI still identifies itself when the firmware query fails.
      if (status === 503 && data.status === 'fail' && data.system_version === null) {
        return { port, version: data.version }
      }
    }
  } catch {
    // Older CPI/RPI builds do not provide /api/status.
  }
  return (await probeRPIPort(address, port)) ? { port } : undefined
}

let activeSearch: Promise<PS4DiscoveryResult> | undefined

export function discoverPS4Hosts(): Promise<PS4DiscoveryResult> {
  // Share concurrent requests so reopening the form cannot flood the network.
  activeSearch ??= discover().finally(() => {
    activeSearch = undefined
  })
  return activeSearch
}

async function discover(): Promise<PS4DiscoveryResult> {
  const interfaces = Object.values(networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === 'IPv4' && !iface.internal && iface.netmask !== '255.255.255.255')
  if (!interfaces.length) return { hosts: [], errorMessage: '没有可用的局域网连接，请检查 Wi-Fi 或网线。' }
  const results = await Promise.allSettled(interfaces.map((iface) => searchInterface(iface!.address, iface!.netmask)))
  if (results.every((result) => result.status === 'rejected')) {
    return { hosts: [], errorMessage: '搜索失败，请检查系统的本地网络权限和防火墙设置。' }
  }
  const hosts = [
    ...new Map(
      results
        .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
        .map((host) => [host.address, host]),
    ).values(),
  ].slice(0, 32)
  // Bound network concurrency even on a busy LAN.
  for (let index = 0; index < hosts.length; index += 8) {
    await Promise.all(
      hosts.slice(index, index + 8).map(async (host) => {
        if (host.status === 'standby') return
        const ports = [12800, 12801]
        const services = await Promise.all(ports.map((port) => probeCPIService(host.address, port)))
        host.services = services.filter((service): service is DiscoveredCPIService => service !== undefined)
        host.ports = host.services.map((service) => service.port)
      }),
    )
  }
  return { hosts: hosts.sort((a, b) => a.name.localeCompare(b.name)) }
}
