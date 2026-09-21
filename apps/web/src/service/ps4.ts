import axios from 'axios'
import JSON5 from 'json5'

import { ProgressInfo } from '@/types'
import { isInPS4Browser } from '@/utils'

const instance = axios.create({
  timeout: 10000,
  transformResponse: [
    function transformResponse(data) {
      if (typeof data === 'string' && data.trim()) {
        return JSON5.parse(data)
      }
      return data
    },
  ],
})

instance.interceptors.request.use((value) => {
  if (!value.baseURL) {
    throw new Error('The PS4 Url is empty')
  }
  return value
})

export const apiBaseUrl = (url: string) => {
  const base = url.replace(/\/$/, '')
  return base.endsWith('/api') ? base : base + '/api'
}
export const changeBaseUrl = (url: string) => {
  instance.defaults.baseURL = apiBaseUrl(url)
}

export enum InstallType {
  DIRECT = 'direct',
  URL = 'ref_pkg_url',
}

export enum PkgType {
  GAME = 6,
  AC = 7,
  PATCH = 8,
  LICENSE = 9,
}

type DirectInstallParams = {
  type: InstallType.DIRECT
  packages: string[]
}

type UrlInstallParams = {
  type: InstallType.URL
  url: string
}

export type InstallParams<T> = T extends InstallType.DIRECT ? DirectInstallParams : UrlInstallParams

export const checkAppExist = (title_id: string) => {
  return instance.post('/is_exists', {
    title_id,
  })
}

export type InstallParseResponse = {
  status: 'success' | 'fail'
  task_id: number
  title: string
  cancel_token?: string
  error_code?: string
}

export const installApi = <T = InstallType>(data: InstallParams<T>, hostUrl?: string) => {
  const config = hostUrl ? { baseURL: apiBaseUrl(hostUrl) } : {}
  if (isInPS4Browser) {
    return instance.get<InstallParseResponse>('/install', { ...config, params: { data } })
  } else {
    return instance.post<InstallParseResponse>('/install', data, config)
  }
}

export const unstallGameApi = (title_id: string) => {
  const data = { title_id }
  if (isInPS4Browser) {
    return instance.get<InstallParseResponse>('/install', { params: { data } })
  } else {
    return instance.post<InstallParseResponse>('/install', data)
  }
}

export const unstallPatchApi = (title_id: string) => {
  const data = { title_id }
  if (isInPS4Browser) {
    return instance.get('/uninstall_patch', { params: { data } })
  } else {
    return instance.post('/uninstall_patch', data)
  }
}

export const unstallACApi = (content_id: string) => {
  const data = { content_id }
  if (isInPS4Browser) {
    return instance.get('/uninstall_ac', { params: { data } })
  } else {
    return instance.post('/uninstall_ac', data)
  }
}

export const unstallThemeApi = (content_id: string) => {
  const data = { content_id }
  if (isInPS4Browser) {
    return instance.get('/uninstall_theme', { params: { data } })
  } else {
    return instance.post('/uninstall_theme', data)
  }
}

export const getTaskIdApi = (content_id: string, sub_type: PkgType) => {
  const data = { content_id, sub_type }
  if (isInPS4Browser) {
    return instance.get('/find_task', { params: { data } })
  } else {
    return instance.post('/find_task', data)
  }
}

type StatusResponse = {
  status: 'success' | 'fail'
  error_code?: number
}

export type TaskProgressResponse = ProgressInfo & StatusResponse

export const getTaskProgressApi = (task_id: number, hostUrl?: string) => {
  const data = { task_id }
  const config = hostUrl ? { baseURL: apiBaseUrl(hostUrl) } : {}
  if (isInPS4Browser) {
    return instance.get<TaskProgressResponse>('/get_task_progress', { ...config, params: { data } })
  } else {
    return instance.post<TaskProgressResponse>('/get_task_progress', data, config)
  }
}

export const startApi = (task_id: number) => {
  const data = { task_id }
  if (isInPS4Browser) {
    return instance.get<StatusResponse>('/start_task', { params: { data } })
  } else {
    return instance.post<StatusResponse>('/start_task', data)
  }
}

export const stopApi = (task_id: number, hostUrl?: string) => {
  const data = { task_id }
  const config = hostUrl ? { baseURL: apiBaseUrl(hostUrl) } : {}
  if (isInPS4Browser) {
    return instance.get<StatusResponse>('/stop_task', { ...config, params: { data } })
  } else {
    return instance.post<StatusResponse>('/stop_task', data, config)
  }
}

export const pauseApi = (task_id: number, hostUrl?: string) => {
  const data = { task_id }
  const config = hostUrl ? { baseURL: apiBaseUrl(hostUrl) } : {}
  if (isInPS4Browser) {
    return instance.get<StatusResponse>('/pause_task', { ...config, params: { data } })
  } else {
    return instance.post<StatusResponse>('/pause_task', data, config)
  }
}

export const resumeApi = (task_id: number, hostUrl?: string) => {
  const data = { task_id }
  const config = hostUrl ? { baseURL: apiBaseUrl(hostUrl) } : {}
  if (isInPS4Browser) {
    return instance.get<StatusResponse>('/resume_task', { ...config, params: { data } })
  } else {
    return instance.post<StatusResponse>('/resume_task', data, config)
  }
}

export class TaskCleanupError extends Error {}

export type CancelResponse = StatusResponse & {
  task_cancelled: boolean
  cleanup: 'deleted' | 'manual_required'
  reason: string
}

export const cancelApi = async (task_id: number, hostUrl: string, cancelToken?: string) => {
  if (!cancelToken) throw new TaskCleanupError('旧任务缺少 CPI 安装记录，请在 PS4 上取消并清理')
  if (!hostUrl) throw new Error('缺少任务所属主机地址')
  try {
    const result = await instance.post<CancelResponse>(
      '/cancel_task',
      { task_id, cancel_token: cancelToken, delete_incomplete: true },
      { baseURL: apiBaseUrl(hostUrl) },
    )
    if (result.data.status !== 'success') throw new Error(`CPI 取消失败：${result.data.error_code ?? '未知错误'}`)
    if (!result.data.task_cancelled || result.data.cleanup !== 'deleted') {
      const reasons: Record<string, string> = {
        patch_or_dlc_requires_review: '下载已取消；补丁或 DLC 残留需在 PS4 清理，已有内容未卸载',
        existing_or_unknown_install: '下载已取消；已有游戏或安装前状态未知，需在 PS4 检查残留',
        unregister_uncertain: '任务注销结果不确定，请在 PS4 检查',
        operation_uncertain: '上次操作结果不确定，请在 PS4 检查',
      }
      throw new TaskCleanupError(reasons[result.data.reason] || '下载已取消，但内容清理未确认，请在 PS4 检查')
    }
    return result
  } catch (error) {
    if (error instanceof TaskCleanupError) throw error
    throw new TaskCleanupError(`取消结果未确认，任务记录已保留：${(error as Error).message}`)
  }
}
