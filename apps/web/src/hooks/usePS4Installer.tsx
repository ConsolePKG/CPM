import { Link, Notification } from '@/components/ui'
import axios from 'axios'
import { useEffect, useRef, useState } from 'react'
import { usePS4HostForm } from './useHostForms'
import { useNavigate } from 'react-router-dom'

import { sampleTransfer, taskKey, transferPercent } from './taskProgress'
import { RPILink } from '@/components/WebAlert'
import {
  cancelApi,
  TaskCleanupError,
  changeBaseUrl,
  getTaskProgressApi,
  installApi,
  InstallParams,
  InstallType,
  pauseApi,
  resumeApi,
} from '@/service/ps4'
import { FileStat, InstallTask, PS4Host, TaskActionType, TaskStatus } from '@/types'
import { getInitConfigFromStore, updateConfigStore } from '@/utils'
import { isPlayStationBrowser } from '@/utils/browser'
import { initializeLocalConsole, localConsoleSetupKey } from './localConsole'
import { getCPIStatus } from '@/service/cpi'
import { installPS5, progressPS5, uploadPS5Icon } from '@/service/ps5'
import { getLibraryPkgInfo } from './pkgInfoReader'

const ps5TasksKey = 'cpm-ps5-install-tasks'
function readPS5Tasks(): InstallTask[] {
  try {
    const saved = JSON.parse(localStorage.getItem(ps5TasksKey) || '[]')
    return Array.isArray(saved)
      ? saved.filter(
          (task): task is InstallTask =>
            task?.platform === 'ps5' &&
            typeof task.contentId === 'string' &&
            typeof task.ps4HostUrl === 'string' &&
            typeof task.file?.basename === 'string',
        )
      : []
  } catch {
    return []
  }
}

export const usePS4Installer = (fileServerHostId?: string) => {
  const [initial] = useState(() => {
    let enabled = isPlayStationBrowser
    try {
      enabled = enabled && localStorage.getItem(localConsoleSetupKey) !== '1'
    } catch {
      /* Storage may be unavailable in private browsing. */
    }
    return {
      ...initializeLocalConsole(
        getInitConfigFromStore('ps4Hosts', []),
        getInitConfigFromStore('curSelectPs4HostId', undefined),
        enabled,
      ),
      enabled,
    }
  })
  const [ps4Hosts, setPs4Hosts] = useState<PS4Host[]>(initial.hosts)
  const [curSelectPs4HostId, setCurSelectPs4HostId] = useState<string | undefined>(initial.selected)
  const [installTasks, setInstallTasks] = useState<InstallTask[]>(readPS5Tasks)
  const [totalSpeedHistory, setTotalSpeedHistory] = useState<number[]>([])
  const lastSpeedSnapshot = useRef('')

  useEffect(() => {
    try {
      localStorage.setItem(
        ps5TasksKey,
        JSON.stringify(
          installTasks
            .filter((task) => task.platform === 'ps5')
            .map((task) => ({
              ...task,
              file: { ...task.file, downloadUrl: undefined, icon0: undefined, addons: undefined, patchs: undefined },
            })),
        ),
      )
    } catch {
      /* Browsers may disable local storage. */
    }
  }, [installTasks])

  useEffect(() => {
    if (!installTasks.length) return
    const active = installTasks.filter((task) => task.status === TaskStatus.INSTALLING)
    const sampled = active.filter((task) => task.downloadSpeed !== undefined)
    if (active.length && !sampled.length) return
    // Poll results arrive as a batch: sum concurrent rates at this moment, not
    // unrelated positions in each game's independently started history.
    const snapshot = sampled.length
      ? sampled
          .map((task) => `${taskKey(task)}:${task.sampleTime}`)
          .sort()
          .join('|')
      : 'idle'
    if (snapshot === lastSpeedSnapshot.current) return
    lastSpeedSnapshot.current = snapshot
    const total = sampled.reduce((sum, task) => sum + (task.downloadSpeed || 0), 0)
    setTotalSpeedHistory((previous) => [...previous.slice(-19), total])
  }, [installTasks])

  const curPs4Host = ps4Hosts.find((item) => item.id === curSelectPs4HostId)

  useEffect(() => {
    if (!curPs4Host || curPs4Host.platform) return
    let cancelled = false
    void getCPIStatus(curPs4Host.url).then((status) => {
      if (!cancelled && status.state === 'online' && status.platform)
        setPs4Hosts((hosts) =>
          hosts.map((host) => (host.id === curPs4Host.id ? { ...host, platform: status.platform } : host)),
        )
    })
    return () => {
      cancelled = true
    }
  }, [curPs4Host?.id, curPs4Host?.url, curPs4Host?.platform])

  useEffect(() => {
    if (curPs4Host?.url) {
      changeBaseUrl(curPs4Host.url)
    }
  }, [curPs4Host?.url])

  useEffect(() => {
    updateConfigStore('ps4Hosts', ps4Hosts)
    updateConfigStore('curSelectPs4HostId', curSelectPs4HostId)
    if (initial.enabled) {
      try {
        localStorage.setItem(localConsoleSetupKey, '1')
      } catch {
        /* Keep session defaults. */
      }
    }
  }, [curSelectPs4HostId, ps4Hosts])

  const navigate = useNavigate()
  const { open: openHostForm } = usePS4HostForm()

  const handleInstall = async (file: FileStat) => {
    let uncertainPS5: { contentId: string; title: string; host: string; fileServerHostId: string } | undefined
    try {
      if (!curPs4Host) {
        return Notification.error({
          id: 'ps4-installer-no-host',
          title: `发送安装任务失败`,
          content: (
            <>
              <p>{file.basename}</p>
              Please
              <Link
                onClick={() => {
                  Notification.remove('ps4-installer-no-host')
                  openHostForm()
                }}
              >
                添加主机
              </Link>
              first
            </>
          ),
          duration: 0,
        })
      }
      if (!fileServerHostId) {
        throw new Error(`File server host not found`)
      }
      if (!file.downloadUrl) {
        throw new Error(`Download url not found`)
      }
      const cpi = await getCPIStatus(curPs4Host.url)
      if (cpi.state === 'online' && cpi.platform === 'ps5') {
        let title = file.paramSfo?.TITLE
        let contentId = file.paramSfo?.CONTENT_ID
        let iconSource: string | Uint8Array | undefined = file.icon0
        if (!title || !contentId || !iconSource) {
          try {
            const info = await getLibraryPkgInfo(file.downloadUrl)
            title ||= info?.paramSfo?.TITLE
            contentId ||= info?.paramSfo?.CONTENT_ID
            iconSource ||= info?.icon0Raw
          } catch {
            /* Fall back to the file name and any cached metadata. */
          }
        }
        title ||= file.basename.replace(/\.pkg$/i, '')
        Notification.info({ id: file.basename, title, content: '正在向 PS5 发送安装任务' })
        let iconUrl: string | undefined
        if ((cpi.iconUpload || window.electron?.servePS5Icon) && iconSource && contentId) {
          try {
            iconUrl = await uploadPS5Icon(curPs4Host.url, contentId, iconSource)
          } catch (error) {
            Notification.error(`PS5 封面上传失败：${(error as Error).message}`)
          }
        }
        if (contentId && /^[A-Za-z0-9]{6}-[A-Za-z0-9]{9}_[A-Za-z0-9]{2}-[A-Za-z0-9]{16}$/.test(contentId))
          uncertainPS5 = { contentId, title, host: curPs4Host.url, fileServerHostId }
        const result = await installPS5(curPs4Host.url, file.downloadUrl, title, iconUrl)
        const task: InstallTask = {
          file,
          taskId: 0,
          contentId: result.content_id,
          platform: 'ps5',
          title,
          ps4HostUrl: curPs4Host.url,
          fileServerHostId,
          nativeState: result.install_state,
          status: TaskStatus.INSTALLING,
        }
        setInstallTasks((previous) =>
          previous.some((item) => taskKey(item) === taskKey(task)) ? previous : [task, ...previous],
        )
        Notification.success({
          id: file.basename,
          title: task.title,
          content: 'PS5 已接受安装任务，可在任务页查看进度',
        })
        return
      }
      Notification.info({
        id: file.basename,
        title: file.basename,
        content: `正在向 PS4 发送安装任务`,
      })
      const params: InstallParams<InstallType.DIRECT> = {
        type: InstallType.DIRECT,
        packages: [file.downloadUrl],
      }
      const { data } = await installApi(params, curPs4Host.url)
      if (data.status === 'fail') {
        // @ts-ignore
        const errorCode = data?.error_code?.toString(16)
        const errorMessage = errorCode?.startsWith('809900')
          ? `请检查游戏是否已经安装`
          : `Install failed ${errorCode ? ': 0x' + errorCode : ''}`
        throw new Error(errorMessage)
      }
      if (data.task_id != null) {
        const task: InstallTask = {
          file,
          taskId: data.task_id,
          cancelToken: data.cancel_token,
          title: data.title,
          ps4HostUrl: curPs4Host.url,
          fileServerHostId,
          status: TaskStatus.INSTALLING,
        }
        setInstallTasks((previous) =>
          previous.some((item) => taskKey(item) === taskKey(task)) ? previous : [task, ...previous],
        )
        Notification.success({
          id: file.basename,
          title: data.title || file.basename,
          content: (
            <>
              安装已开始，
              <Link
                onClick={() => {
                  Notification.remove(file.basename)
                  navigate(`/tasks`)
                }}
              >
                查看进度
              </Link>
            </>
          ),
        })
      }
    } catch (err) {
      if (uncertainPS5 && axios.isAxiosError(err) && !err.response) {
        const task: InstallTask = {
          file,
          taskId: 0,
          contentId: uncertainPS5.contentId,
          platform: 'ps5',
          title: uncertainPS5.title,
          ps4HostUrl: uncertainPS5.host,
          fileServerHostId: uncertainPS5.fileServerHostId,
          status: TaskStatus.INSTALLING,
          errorMessage: '安装响应中断，正在等待 CPI 恢复并确认任务状态',
        }
        setInstallTasks((previous) =>
          previous.some((item) => taskKey(item) === taskKey(task)) ? previous : [task, ...previous],
        )
        Notification.info({
          id: file.basename,
          title: task.title,
          content: '与 CPI 的连接中断。任务页会按包的 Content ID 查询结果，请勿重复发送。',
          duration: 0,
        })
        return
      }
      // @ts-ignore
      const errMessage = String(err?.response?.data?.error || err?.message || '未知错误')
      const isErrorCausedByFilePathFormat = errMessage.includes('Unable to set up prerequisites for package')
      Notification.error({
        id: file.basename,
        title: `${file.basename} Install failed`,
        duration: 0,
        content: errMessage ? (
          <>
            <span>{errMessage}</span>
            {isErrorCausedByFilePathFormat && (
              <p>
                This may be caused by the presence of Chinese characters or spaces in the file path. You can try this
                remote pkg installer on your PS4: <RPILink />
              </p>
            )}
          </>
        ) : null,
      })
    }
  }

  useEffect(() => {
    const needCheckInstallTasks = installTasks.filter((item) => item.status === TaskStatus.INSTALLING)

    if (!needCheckInstallTasks.length) {
      return
    }

    let didCheckProgressCacncel = false
    let checking = false

    const checkProgress = async () => {
      if (checking) return
      checking = true
      const promises = needCheckInstallTasks.map(async (item) => {
        try {
          if (item.platform === 'ps5' && item.contentId) {
            const data = await progressPS5(item.ps4HostUrl, item.contentId)
            if (didCheckProgressCacncel) return undefined
            const transferred = data.downloaded_size || 0
            const total = data.total_size || item.file.size
            const rawState = data.install_state || ''
            const complete = /^(playable|complete|completed|finished|done|installed)$/i.test(rawState)
            const percent = complete ? 100 : Math.min(99, transferPercent(transferred, total))
            const progressInfo = {
              preparing_percent: data.promote_progress || 0,
              local_copy_percent: data.local_copy_percent || 0,
              rest_sec: 0,
              rest_sec_total: 0,
              num_index: 0,
              num_total: 0,
              length: transferred,
              length_total: total,
              transferred,
              transferred_total: transferred,
              error: data.install_error || 0,
              bits: 0,
              _percent: percent,
            }
            if (data.install_error) throw new Error(`PS5 安装错误：0x${(data.install_error >>> 0).toString(16)}`)
            return {
              taskId: item.taskId,
              contentId: item.contentId,
              ps4HostUrl: item.ps4HostUrl,
              status: complete ? TaskStatus.FINISHED : TaskStatus.INSTALLING,
              nativeState: rawState,
              progressInfo,
              errorMessage: undefined,
              ...sampleTransfer(item, transferred, Date.now()),
            }
          }
          const { data } = await getTaskProgressApi(item.taskId, item.ps4HostUrl)
          if (didCheckProgressCacncel) return undefined
          if (data.status === 'fail') throw new Error(`读取进度失败: ${data.error_code || data.error || ''}`)
          data._percent = transferPercent(data.transferred_total, data.length_total)
          if (data._percent === 100) {
            if (window.electron) {
              new window.Notification(item.title, { body: '安装完成' })
            } else {
              Notification.success({
                id: item.title,
                title: item.title,
                content: `安装完成`,
              })
            }
          }
          return {
            taskId: item.taskId,
            status: data._percent === 100 ? TaskStatus.FINISHED : TaskStatus.INSTALLING,
            progressInfo: data,
            ps4HostUrl: item.ps4HostUrl,
            errorMessage: undefined,
            ...sampleTransfer(item, data.transferred_total, Date.now()),
          }
        } catch (err) {
          return {
            taskId: item.taskId,
            contentId: item.contentId,
            status: item.platform === 'ps5' ? TaskStatus.INSTALLING : TaskStatus.PAUSED,
            errorMessage: (err as Error).message,
            ps4HostUrl: item.ps4HostUrl,
          }
        }
      })
      const res = await Promise.all(promises)
      checking = false
      if (!didCheckProgressCacncel) {
        setInstallTasks((pre) => {
          const newInstallTasks = pre.reduce<InstallTask[]>((acc, cur) => {
            const curProgressInfo = res.find(
              (item) =>
                item?.ps4HostUrl === cur.ps4HostUrl &&
                (cur.platform === 'ps5' ? item?.contentId === cur.contentId : item?.taskId === cur.taskId),
            )
            if (curProgressInfo && !cur.cleanupPending) {
              acc.push({ ...cur, ...curProgressInfo })
            } else {
              acc.push(cur)
            }
            return acc
          }, [])
          return newInstallTasks
        })
      }
    }
    // checkProgress();

    let timer: number | undefined = undefined

    timer = window.setInterval(checkProgress, 3000)

    return () => {
      didCheckProgressCacncel = true
      clearInterval(timer)
    }
  }, [installTasks])

  const handleChangeInstallTaskStatus = async (installTask: InstallTask, actionType: TaskActionType) => {
    try {
      if (actionType === TaskActionType.DELETE) {
        setInstallTasks((pre) => pre.filter((item) => taskKey(item) !== taskKey(installTask)))
        return
      }
      if (installTask.platform === 'ps5') throw new Error('当前 PS5 CPI 尚未提供经过验证的暂停、恢复或取消接口')
      const { data } = await (actionType === TaskActionType.PAUSE
        ? pauseApi(installTask.taskId, installTask.ps4HostUrl)
        : actionType === TaskActionType.RESUME
          ? resumeApi(installTask.taskId, installTask.ps4HostUrl)
          : cancelApi(installTask.taskId, installTask.ps4HostUrl, installTask.cancelToken))
      if (data.status === 'success') {
        setInstallTasks((pre) => {
          const cur = pre.find((item) => taskKey(item) === taskKey(installTask))
          if (cur) {
            cur.errorMessage = undefined
            cur.sampleTime = undefined
            cur.downloadSpeed = undefined
            cur.status =
              actionType === TaskActionType.PAUSE
                ? TaskStatus.PAUSED
                : actionType === TaskActionType.RESUME
                  ? TaskStatus.INSTALLING
                  : cur.status
          }
          if (actionType === TaskActionType.CANCEL) {
            return pre.filter((item) => taskKey(item) !== taskKey(installTask))
          } else {
            return [...pre]
          }
        })
        Notification.success({
          title: installTask.title,
          content: actionType === TaskActionType.CANCEL ? '任务已取消并删除' : `${actionType} success`,
        })
      } else {
        if (data.status === 'fail') {
          throw new Error(String(data.error_code || 'not found error code'))
        }
      }
    } catch (err) {
      if (err instanceof TaskCleanupError) {
        setInstallTasks((previous) =>
          previous.map((item) =>
            taskKey(item) === taskKey(installTask)
              ? {
                  ...item,
                  cleanupPending: true,
                  status: TaskStatus.PAUSED,
                  errorMessage: err.message,
                  downloadSpeed: undefined,
                }
              : item,
          ),
        )
      }
      Notification.error({
        title: installTask.title,
        content:
          actionType === TaskActionType.CANCEL
            ? `取消失败，任务记录已保留：${(err as Error).message}`
            : `${actionType} failed: ${(err as Error).message}`,
      })
    }
  }

  return {
    installTasks,
    totalSpeedHistory,
    handleInstall,
    ps4Hosts,
    curSelectPs4HostId,
    setPs4Hosts,
    setCurSelectPs4HostId,
    handleChangeInstallTaskStatus,
  }
}
