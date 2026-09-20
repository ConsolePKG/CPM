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

export const stopApi = (task_id: number) => {
  const data = { task_id }
  if (isInPS4Browser) {
    return instance.get<StatusResponse>('/stop_task', { params: { data } })
  } else {
    return instance.post<StatusResponse>('/stop_task', data)
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

export const cancelApi = (task_id: number, hostUrl?: string) => {
  const data = { task_id }
  const config = hostUrl ? { baseURL: apiBaseUrl(hostUrl) } : {}
  if (isInPS4Browser) {
    return instance.get<StatusResponse>('/unregister_task', { ...config, params: { data } })
  } else {
    return instance.post<StatusResponse>('/unregister_task', data, config)
  }
}
