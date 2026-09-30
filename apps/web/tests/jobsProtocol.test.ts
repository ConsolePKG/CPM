import { describe, expect, it } from '@rstest/core'
import { createServer } from 'node:http'
import { createProtocolMock } from '../mock/protocol.mjs'
import { ConsoleJobsClient } from '../src/service/jobs'
import { RemoteLibraryClient } from '../../../packages/library/src/client'

describe('real clients consume deterministic protocol mocks', () => {
  it('serves scoped HEAD/Range downloads and rejects access after share revocation', async () => {
    const mock = createProtocolMock({
      files: [{ basename: 'game.pkg', size: 1000, paramSfo: { TITLE: 'Game', TITLE_ID: 'CUSA12345' } }],
      now: () => 0,
    })
    let address = ''
    const server = createServer((request, response) => {
      void mock.handle(request, response, address)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    address = `http://127.0.0.1:${(server.address() as any).port}`
    try {
      const admin = new RemoteLibraryClient(address, 'fixture-admin')
      const share = await admin.createShare('fixture-library')
      const shared = new RemoteLibraryClient(address, share.token)
      const file = (await shared.listFiles('fixture-library')).items[0]
      const game = (await shared.listGames('fixture-library')).items[0]
      expect((await shared.getGame('fixture-library', game.id)).base).toEqual([file.id])
      const download = await shared.download(file.id)
      expect((await fetch(download.url!, { method: 'HEAD' })).headers.get('content-length')).toBe('1000')
      const range = await fetch(download.url!, { headers: { Range: 'bytes=0-3' } })
      expect(range.status).toBe(206)
      expect(range.headers.get('content-range')).toBe('bytes 0-3/1000')
      expect(new Uint8Array(await range.arrayBuffer())).toEqual(new Uint8Array([127, 67, 78, 84]))
      await admin.revokeShare(share.id)
      expect((await fetch(download.url!)).status).toBe(403)
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
  it('preserves the global fetch receiver in browser-compatible defaults', async () => {
    const original = globalThis.fetch
    globalThis.fetch = async function () {
      expect(this).toBe(globalThis)
      return Response.json({ protocolVersion: 1 })
    }
    try {
      expect((await new ConsoleJobsClient('http://console').capabilities()).protocolVersion).toBe(1)
      expect((await new RemoteLibraryClient('http://library').capabilities()).protocolVersion).toBe(1)
    } finally {
      globalThis.fetch = original
    }
  })
  it('runs library sharing, PS4 job phases, lost responses, new attempts and failures', async () => {
    let clock = 0
    const mock = createProtocolMock({ now: () => clock })
    const server = createServer((request, response) => {
      void mock.handle(request, response, 'http://127.0.0.1').catch(() => response.destroy())
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = `http://127.0.0.1:${(server.address() as any).port}`
    const host = new ConsoleJobsClient(address)
    const admin = new RemoteLibraryClient(address, 'fixture-admin')
    try {
      const share = await admin.createShare('fixture-library')
      const shared = new RemoteLibraryClient(address, share.token)
      expect((await shared.listLibraries())[0].id).toBe('fixture-library')
      const submission = {
        idempotencyKey: 'one',
        url: 'http://library/file.pkg',
        contentId: 'UP0001-CUSA12345_00-ABCDEFGHIJKLMNOP',
      }
      mock.loseNextResponse('one')
      await expect(host.submit(submission)).rejects.toThrow()
      const first = await host.submit(submission)
      expect(mock.jobs.size).toBe(1)
      expect(first.jobId).toBe('1')
      for (const [time, state] of [
        [1000, 'submitting'],
        [2000, 'accepted'],
        [4000, 'transferring'],
        [16000, 'installing'],
        [18000, 'completed'],
      ] as const) {
        clock = time
        expect((await host.get(first.jobId)).state).toBe(state)
      }
      const second = await host.submit({ ...submission, idempotencyKey: 'two' })
      expect(second.jobId).not.toBe(first.jobId)
      mock.fail(second.jobId)
      expect((await host.get(second.jobId)).state).toBe('failed')
      const retried = await host.action(second.jobId, 'retry', 'retry-two')
      expect(retried.jobId).not.toBe(second.jobId)
      expect((await host.action(second.jobId, 'retry', 'retry-two')).jobId).toBe(retried.jobId)
      await expect(host.action(retried.jobId, 'retry', 'unsafe-retry')).rejects.toThrow('terminal')
      await admin.revokeShare(share.id)
      await expect(shared.listLibraries()).rejects.toThrow('Authorization')
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
  it('does not enable unverified PS5 native actions', async () => {
    const mock = createProtocolMock({ platform: 'ps5', now: () => 0 })
    const server = createServer((request, response) => {
      void mock.handle(request, response, 'http://127.0.0.1')
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const client = new ConsoleJobsClient(`http://127.0.0.1:${(server.address() as any).port}`)
    try {
      expect((await client.capabilities()).cancel).toBe(false)
      const job = await client.submit({ idempotencyKey: 'ps5', url: 'http://library/game.pkg' })
      expect(job.nativeRef.task_id).toBeUndefined()
      await expect(client.action(job.jobId, 'pause')).rejects.toThrow('Unsupported')
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
})
