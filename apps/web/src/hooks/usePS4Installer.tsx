import { Link, Notification } from '@/components/ui'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { sampleTransfer, taskKey, transferPercent } from './taskProgress'
import { RPILink } from '@/components/WebAlert'
import {
  cancelApi,
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

export const usePS4Installer = (fileServerHostId?: string) => {
  const [ps4Hosts, setPs4Hosts] = useState<PS4Host[]>(() => getInitConfigFromStore('ps4Hosts', []))
  const [curSelectPs4HostId, setCurSelectPs4HostId] = useState<string | undefined>(() =>
    getInitConfigFromStore('curSelectPs4HostId', undefined),
  )
  const [installTasks, setInstallTasks] = useState<InstallTask[]>([])
  const [totalSpeedHistory, setTotalSpeedHistory] = useState<number[]>([])
  const lastSpeedSnapshot = useRef('')

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
    if (curPs4Host?.url) {
      changeBaseUrl(curPs4Host.url)
    }
  }, [curPs4Host?.url])

  useEffect(() => {
    updateConfigStore('ps4Hosts', ps4Hosts)
    updateConfigStore('curSelectPs4HostId', curSelectPs4HostId)
  }, [curSelectPs4HostId, ps4Hosts])

  const navigate = useNavigate()

  const handleInstall = async (file: FileStat) => {
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
                  navigate('/hosts?openPs4Host=true')
                }}
              >
                添加 PS4 主机
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
            status: TaskStatus.PAUSED,
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
              (item) => item?.taskId === cur.taskId && item?.ps4HostUrl === cur.ps4HostUrl,
            )
            if (curProgressInfo) {
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
      const { data } = await (actionType === TaskActionType.PAUSE
        ? pauseApi(installTask.taskId, installTask.ps4HostUrl)
        : actionType === TaskActionType.RESUME
          ? resumeApi(installTask.taskId, installTask.ps4HostUrl)
          : cancelApi(installTask.taskId, installTask.ps4HostUrl))
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
          content: `${actionType} success`,
        })
      } else {
        if (data.status === 'fail') {
          throw new Error(String(data.error_code || 'not found error code'))
        }
      }
    } catch (err) {
      Notification.error({
        title: installTask.title,
        content: `${actionType} failed: ${(err as Error).message}`,
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
