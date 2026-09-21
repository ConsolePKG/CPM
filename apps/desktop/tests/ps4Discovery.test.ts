import { afterEach, beforeEach, describe, expect, it, rstest } from '@rstest/core'
import { EventEmitter } from 'node:events'
import {
  broadcastAddress,
  discoverPS4Hosts,
  parsePS4Response,
  probeCPIService,
  probeRPIPort,
} from '../src/ps4Discovery'

const mocks = rstest.hoisted(() => ({
  interfaces: rstest.fn(),
  createSocket: rstest.fn(),
  post: rstest.fn(),
  get: rstest.fn(),
}))
rstest.mock('node:os', () => ({ networkInterfaces: mocks.interfaces }))
rstest.mock('node:dgram', () => ({ createSocket: mocks.createSocket }))
rstest.mock('axios', () => ({ default: { post: mocks.post, get: mocks.get } }))

const response = (code = 200, type = 'PS4') =>
  `HTTP/1.1 ${code} OK\r\nhost-type:${type}\r\nhost-id:abcd\r\nhost-name:PS4: 客厅\r\n`
class Socket extends EventEmitter {
  close = rstest.fn()
  setBroadcast = rstest.fn()
  send = rstest.fn()
  bind = rstest.fn((_port: number, _address: string, ready: () => void) => ready())
}
let sockets: Socket[]
beforeEach(() => {
  rstest.useFakeTimers()
  rstest.clearAllMocks()
  sockets = []
  mocks.interfaces.mockReturnValue({
    en0: [{ family: 'IPv4', internal: false, address: '192.168.2.10', netmask: '255.255.255.0' }],
  })
  mocks.createSocket.mockImplementation(() => {
    const socket = new Socket()
    sockets.push(socket)
    return socket
  })
  mocks.get.mockResolvedValue({ status: 404, data: '' })
  mocks.post.mockResolvedValue({ status: 200, data: { status: 'success', exists: false, size: 0 } })
})
afterEach(() => {
  rstest.useRealTimers()
})

describe('PS4 discovery', () => {
  it('uses the actual subnet mask for broadcasts', () => {
    expect(broadcastAddress('192.168.2.10', '255.255.255.0')).toBe('192.168.2.255')
    expect(broadcastAddress('10.12.3.4', '255.255.0.0')).toBe('10.12.255.255')
    expect(broadcastAddress('172.16.3.4', '255.255.254.0')).toBe('172.16.3.255')
  })
  it('parses awake and standby consoles without trusting advertised addresses', () => {
    expect(parsePS4Response(response() + 'host-ip:10.0.0.1\n', '192.168.2.20')).toMatchObject({
      name: 'PS4: 客厅',
      address: '192.168.2.20',
      status: 'awake',
      ports: [],
    })
    expect(parsePS4Response(response(620).replaceAll('\r', ''), '192.168.2.20')?.status).toBe('standby')
    expect(parsePS4Response(response(200, 'PS5'), '192.168.2.20')).toBeUndefined()
    expect(parsePS4Response('SRCH * HTTP/1.1\n', '192.168.2.20')).toBeUndefined()
    expect(parsePS4Response(response(), 'bad-address')).toBeUndefined()
  })
  it('accepts ephemeral reply ports, deduplicates replies, probes RPI and releases sockets', async () => {
    const pending = discoverPS4Hosts()
    expect(discoverPS4Hosts()).toBe(pending)
    const socket = sockets[0]
    const remote = { port: 53874, address: '192.168.2.20' }
    socket.emit('message', Buffer.from(response()), remote)
    socket.emit('message', Buffer.from(response()), remote)
    socket.emit('message', Buffer.from(response()), { port: 987, address: '10.0.0.1' })
    socket.emit('message', Buffer.from(response(200, 'PS5')), { port: 999, address: '192.168.2.30' })
    await rstest.advanceTimersByTimeAsync(3000)
    expect((await pending).hosts).toHaveLength(1)
    expect((await pending).hosts[0].ports).toEqual([12800, 12801])
    expect(socket.send.mock.calls[0][0].toString()).toBe(
      'SRCH * HTTP/1.1\ndevice-discovery-protocol-version:00020020\n',
    )
    expect(socket.send.mock.calls[0].slice(1, 3)).toEqual([987, '192.168.2.255'])
    expect(socket.close).toHaveBeenCalledTimes(1)
    const sends = socket.send.mock.calls.length
    await rstest.advanceTimersByTimeAsync(3000)
    expect(socket.send).toHaveBeenCalledTimes(sends)
  })
  it('lists standby consoles without probing or waking them', async () => {
    const pending = discoverPS4Hosts()
    sockets[0].emit('message', Buffer.from(response(620)), { port: 987, address: '192.168.2.20' })
    await rstest.advanceTimersByTimeAsync(3000)
    expect((await pending).hosts[0]).toMatchObject({ status: 'standby', ports: [] })
    expect(mocks.post).not.toHaveBeenCalled()
    expect(mocks.get).not.toHaveBeenCalled()
  })
  it('handles network errors and allows another search afterwards', async () => {
    const pending = discoverPS4Hosts()
    sockets[0].emit('error', new Error('EACCES'))
    expect((await pending).errorMessage).toBeTruthy()
    expect(sockets[0].close).toHaveBeenCalledTimes(1)
    const retry = discoverPS4Hosts()
    await rstest.advanceTimersByTimeAsync(3000)
    expect(await retry).toEqual({ hosts: [] })
  })
  it('reports a missing network without opening sockets', async () => {
    mocks.interfaces.mockReturnValue({ lo0: [{ family: 'IPv4', internal: true }] })
    expect((await discoverPS4Hosts()).errorMessage).toBeTruthy()
    expect(mocks.createSocket).not.toHaveBeenCalled()
  })
  it('propagates CPI and firmware versions per discovered port', async () => {
    mocks.get.mockImplementation(async (url: string) => ({
      status: 200,
      data: { status: 'success', version: url.includes(':12801/') ? '2.06' : '2.05', system_version: '12.02' },
    }))
    const pending = discoverPS4Hosts()
    sockets[0].emit('message', Buffer.from(response()), { port: 987, address: '192.168.2.20' })
    await rstest.advanceTimersByTimeAsync(3000)
    expect((await pending).hosts[0].services).toEqual([
      { port: 12800, version: '2.05', systemVersion: '12.02' },
      { port: 12801, version: '2.06', systemVersion: '12.02' },
    ])
    expect(mocks.post).not.toHaveBeenCalled()
    expect(mocks.get).toHaveBeenCalledWith(
      'http://192.168.2.20:12801/api/status',
      expect.objectContaining({ timeout: 1200, maxRedirects: 0, proxy: false }),
    )
  })
  it('retains CPI version when firmware cannot be read', async () => {
    mocks.get.mockResolvedValueOnce({ status: 503, data: { status: 'fail', version: '2.06', system_version: null } })
    expect(await probeCPIService('192.168.2.20', 12801)).toEqual({ port: 12801, version: '2.06' })
    expect(mocks.post).not.toHaveBeenCalled()
  })
  it('falls back for legacy servers without inventing versions', async () => {
    expect(await probeCPIService('192.168.2.20', 12801)).toEqual({ port: 12801 })
    mocks.get.mockRejectedValueOnce(new Error('timeout'))
    mocks.post.mockRejectedValueOnce(new Error('timeout'))
    expect(await probeCPIService('192.168.2.20', 12801)).toBeUndefined()
    mocks.get.mockResolvedValueOnce({ status: 200, data: { status: 'success', version: {}, system_version: 900 } })
    mocks.post.mockResolvedValueOnce({ status: 404, data: '' })
    expect(await probeCPIService('192.168.2.20', 12801)).toBeUndefined()
  })
  it('does not mistake generic HTTP errors or timeouts for an installer', async () => {
    mocks.post.mockResolvedValueOnce({ status: 400, data: '<html>Bad Request</html>' })
    expect(await probeRPIPort('192.168.2.20', 12800)).toBe(false)
    mocks.post.mockRejectedValueOnce(new Error('timeout'))
    expect(await probeRPIPort('192.168.2.20', 12801)).toBe(false)
    expect(mocks.post).toHaveBeenLastCalledWith(
      'http://192.168.2.20:12801/api/is_exists',
      { title_id: 'CUSA00000' },
      expect.objectContaining({
        timeout: 1200,
        maxRedirects: 0,
        proxy: false,
      }),
    )
  })
})
