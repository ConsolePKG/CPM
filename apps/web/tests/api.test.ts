import { beforeEach, describe, it, expect, rstest } from '@rstest/core'
const { client } = rstest.hoisted(() => ({
  client: {
    defaults: { baseURL: '' },
    interceptors: { request: { use: () => {} } },
    get: rstest.fn(async () => ({ data: { status: 'success' } })),
    post: rstest.fn(async () => ({ data: { status: 'success' } })),
  },
}))
rstest.mock('axios', () => ({ default: { create: () => client } }))
import {
  apiBaseUrl,
  installApi,
  InstallType,
  changeBaseUrl,
  pauseApi,
  resumeApi,
  cancelApi,
  getTaskProgressApi,
} from '../src/service/ps4'
beforeEach(() => {
  rstest.clearAllMocks()
})

describe('task host routing', () => {
  it('normalizes existing /api paths without duplicating the suffix', () => {
    expect(apiBaseUrl('http://one:12801/')).toBe('http://one:12801/api')
    expect(apiBaseUrl('http://one:12801/api/')).toBe('http://one:12801/api')
  })
  it('keeps progress and every task action on the originating host after switching', async () => {
    changeBaseUrl('http://two:12801')
    for (const [fn, route] of [
      [getTaskProgressApi, 'get_task_progress'],
      [pauseApi, 'pause_task'],
      [resumeApi, 'resume_task'],
    ] as const) {
      await fn(7, 'http://one:12801')
      expect(client.post).toHaveBeenLastCalledWith('/' + route, { task_id: 7 }, { baseURL: 'http://one:12801/api' })
    }
    const install = { type: InstallType.DIRECT as const, packages: ['http://files/game.pkg'] }
    await installApi(install, 'http://one:12801')
    expect(client.post).toHaveBeenLastCalledWith('/install', install, { baseURL: 'http://one:12801/api' })
    expect(client.defaults.baseURL).toBe('http://two:12801/api')
  })
})

describe('unified cancellation', () => {
  it('uses one CPI request and preserves the originating host', async () => {
    client.post.mockResolvedValueOnce({
      data: { status: 'success', task_cancelled: true, cleanup: 'deleted' },
    } as never)
    changeBaseUrl('http://two:12801')
    await cancelApi(7, 'http://one:12801', 'job-123456')
    expect(client.post).toHaveBeenCalledTimes(1)
    expect(client.post).toHaveBeenCalledWith(
      '/cancel_task',
      { task_id: 7, cancel_token: 'job-123456', delete_incomplete: true },
      { baseURL: 'http://one:12801/api' },
    )
  })
  it('preserves records for patches and DLC instead of reporting deletion', async () => {
    client.post.mockResolvedValueOnce({
      data: {
        status: 'success',
        task_cancelled: true,
        cleanup: 'manual_required',
        reason: 'patch_or_dlc_requires_review',
      },
    } as never)
    await expect(cancelApi(7, 'http://one:12801', 'job-123456')).rejects.toThrow('补丁或 DLC')
    expect(client.post).toHaveBeenCalledTimes(1)
  })
  it('does not fall back to destructive legacy calls on failure or old CPI', async () => {
    client.post.mockRejectedValueOnce(new Error('404'))
    await expect(cancelApi(7, 'http://one:12801', 'job-123456')).rejects.toThrow('取消结果未确认')
    expect(client.post).toHaveBeenCalledTimes(1)
  })
  it('requires a server-issued cancellation token for old tasks', async () => {
    await expect(cancelApi(7, 'http://one:12801')).rejects.toThrow('旧任务')
    expect(client.post).not.toHaveBeenCalled()
  })
  it('treats unrecognized success responses as unconfirmed cleanup', async () => {
    client.post.mockResolvedValueOnce({ data: { status: 'success' } })
    await expect(cancelApi(7, 'http://one:12801', 'job-123456')).rejects.toThrow('清理未确认')
  })
})
