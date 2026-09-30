import { Notification } from '@/components/ui'
import { useEffect, useRef, useState } from 'react'
import { usePS4HostForm } from './useHostForms'
import { canControlJob, sampleTransfer, taskKey, transferPercent } from './taskProgress'
import { FileStat, InstallTask, PS4Host, TaskActionType, TaskStatus } from '@/types'
import { getInitConfigFromStore, updateConfigStore } from '@/utils'
import { isPlayStationBrowser } from '@/utils/browser'
import { initializeLocalConsole, localConsoleSetupKey } from './localConsole'
import { ConsoleJobsClient, JobApiError, type Job, type JobSubmission } from '@/service/jobs'
import { uploadPS5Icon } from '@/service/ps5'
import { resourceDownload } from '@/library/runtime'
import { newId } from '@consolepkg/library'

const storageKey = 'cpm-console-jobs-v1'
const persistTasks = (tasks: InstallTask[]) =>
  localStorage.setItem(
    storageKey,
    JSON.stringify(
      tasks.map((task) => ({
        ...task,
        file: { ...task.file, icon0: undefined, addons: undefined, patchs: undefined },
      })),
    ),
  )
function useLocalConsoleDefaults() {
  let setup = false
  try {
    setup = localStorage.getItem(localConsoleSetupKey) === '1'
  } catch {}
  return initializeLocalConsole(
    getInitConfigFromStore('ps4Hosts', []),
    getInitConfigFromStore('curSelectPs4HostId', undefined),
    isPlayStationBrowser && !setup,
  )
}
const statusOf = (job: Job) =>
  job.state === 'completed'
    ? TaskStatus.FINISHED
    : job.state === 'failed'
      ? TaskStatus.FAILED
      : job.state === 'cancelled'
        ? TaskStatus.CANCELLED
        : job.state === 'unknown'
          ? TaskStatus.UNKNOWN
          : job.state === 'paused'
            ? TaskStatus.PAUSED
            : TaskStatus.INSTALLING
function loadTasks(): InstallTask[] {
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved) return JSON.parse(saved)
    const legacy = JSON.parse(localStorage.getItem('cpm-ps5-install-tasks') || '[]')
    if (!Array.isArray(legacy)) return []
    localStorage.setItem('cpm-console-jobs-migration-backup', JSON.stringify(legacy))
    return legacy.map((task) => ({
      ...task,
      taskId: undefined,
      jobState: 'unknown',
      status: TaskStatus.UNKNOWN,
      errorMessage: '旧任务没有主机 jobId；请在主机上核对，不能自动重装',
    }))
  } catch {
    return []
  }
}
function applyJob(task: InstallTask, job: Job): InstallTask {
  const progressInfo = {
    preparing_percent: 0,
    local_copy_percent: 0,
    rest_sec: 0,
    rest_sec_total: 0,
    num_index: 0,
    num_total: 0,
    length: job.progress.total,
    length_total: job.progress.total,
    transferred: job.progress.transferred,
    transferred_total: job.progress.transferred,
    error: job.errorCode || 0,
    bits: 0,
    _percent: transferPercent(job.progress.transferred, job.progress.total),
  }
  return {
    ...task,
    jobId: job.jobId,
    taskId: job.nativeRef.task_id !== undefined && job.nativeRef.task_id >= 0 ? job.nativeRef.task_id : undefined,
    contentId: job.nativeRef.content_id || undefined,
    platform: job.platform,
    title: job.title || task.title,
    jobState: job.state,
    nativeState: job.nativeState,
    status: statusOf(job),
    progressInfo,
    offline: false,
    lastSyncedAt: Date.now(),
    errorMessage: job.error || undefined,
    ...sampleTransfer(task, job.progress.transferred, Date.now()),
  }
}
export const usePS4Installer = (fileServerHostId?: string) => {
  const [initial] = useState(useLocalConsoleDefaults)
  const [ps4Hosts, setPs4Hosts] = useState<PS4Host[]>(initial.hosts)
  const [curSelectPs4HostId, setCurSelectPs4HostId] = useState<string | undefined>(initial.selected)
  const [installTasks, setInstallTasks] = useState<InstallTask[]>(loadTasks)
  const [totalSpeedHistory, setTotalSpeedHistory] = useState<number[]>([])
  const tasksRef = useRef(installTasks)
  tasksRef.current = installTasks
  const { open: openHostForm } = usePS4HostForm()
  useEffect(() => {
    updateConfigStore('ps4Hosts', ps4Hosts)
    updateConfigStore('curSelectPs4HostId', curSelectPs4HostId)
  }, [ps4Hosts, curSelectPs4HostId])
  useEffect(() => {
    try {
      persistTasks(installTasks)
    } catch {
      Notification.error('任务引用无法持久化；重新打开后请从主机任务列表恢复')
    }
  }, [installTasks])
  useEffect(() => {
    let stopped = false
    void Promise.all(
      ps4Hosts.map(async (host) => {
        try {
          const client = new ConsoleJobsClient(host.url)
          const capabilities = await client.capabilities()
          let cursor: string | undefined
          const jobs: Job[] = []
          do {
            const page = await client.list(cursor)
            jobs.push(...page.items)
            cursor = page.nextCursor
          } while (cursor)
          if (!stopped)
            setInstallTasks((previous) => {
              const restored = jobs
                .filter(
                  (job) =>
                    !previous.some(
                      (task) =>
                        (task.hostId === host.id || task.ps4HostUrl === host.url) &&
                        (task.jobId === job.jobId || task.idempotencyKey === job.idempotencyKey),
                    ),
                )
                .map((job) =>
                  applyJob(
                    {
                      file: {
                        filename: `cpi-job-${job.jobId}`,
                        basename: job.title || `CPI job ${job.jobId}`,
                        type: 'file',
                        size: job.progress.total,
                        etag: '',
                        lastmod: '',
                      },
                      hostId: host.id,
                      capabilities,
                      title: job.title,
                      ps4HostUrl: host.url,
                      fileServerHostId: '',
                      status: TaskStatus.UNKNOWN,
                    },
                    job,
                  ),
                )
              return [
                ...restored,
                ...previous.map((task) => {
                  if (task.hostId !== host.id && task.ps4HostUrl !== host.url) return task
                  const job = jobs.find((job) => task.jobId === job.jobId || task.idempotencyKey === job.idempotencyKey)
                  return job ? applyJob({ ...task, hostId: host.id, capabilities }, job) : task
                }),
              ]
            })
        } catch {}
      }),
    )
    return () => {
      stopped = true
    }
  }, [ps4Hosts])
  useEffect(() => {
    let stopped = false
    let checking = false
    const poll = async () => {
      if (checking) return
      checking = true
      const pendingTasks = tasksRef.current.filter(
        (task) =>
          !['completed', 'failed', 'cancelled'].includes(task.jobState || '') &&
          (task.jobId || task.submission || task.retryOfJobId),
      )
      const updates: { original: string; task: InstallTask }[] = []
      let next = 0
      await Promise.all(
        Array.from({ length: Math.min(4, pendingTasks.length) }, async () => {
          while (next < pendingTasks.length && !stopped) {
            const task = pendingTasks[next++]
            try {
              const client = new ConsoleJobsClient(task.ps4HostUrl)
              const job = task.jobId
                ? await client.get(task.jobId)
                : task.retryOfJobId
                  ? await client.action(task.retryOfJobId, 'retry', task.idempotencyKey)
                  : await client.submit(task.submission!)
              updates.push({ original: taskKey(task), task: applyJob(task, job) })
            } catch (error) {
              const rejected =
                !task.jobId &&
                error instanceof JobApiError &&
                error.status >= 400 &&
                error.status < 500 &&
                error.status !== 408 &&
                error.status !== 429
              updates.push({
                original: taskKey(task),
                task: {
                  ...task,
                  ...(rejected ? { jobState: 'failed' as const, status: TaskStatus.FAILED } : {}),
                  offline: !rejected,
                  errorMessage: (error as Error).message,
                  downloadSpeed: undefined,
                },
              })
            }
          }
        }),
      )
      checking = false
      if (!stopped) {
        setInstallTasks((previous) =>
          previous.map((task) => updates.find((update) => update.original === taskKey(task))?.task || task),
        )
        const total = updates.reduce((sum, update) => sum + (update.task.downloadSpeed || 0), 0)
        setTotalSpeedHistory((previous) => [...previous.slice(-19), total])
      }
    }
    void poll()
    const timer = window.setInterval(poll, 3000)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [])
  const handleInstall = async (file: FileStat) => {
    const host = ps4Hosts.find((host) => host.id === curSelectPs4HostId)
    if (!host) {
      openHostForm()
      return
    }
    try {
      const client = new ConsoleJobsClient(host.url)
      const capabilities = await client.capabilities()
      if (!capabilities.jobs || capabilities.protocolVersion !== 1)
        throw new Error('请更新 CPI：此主机没有可恢复的 v1 job 接口')
      if (
        file.resourceId &&
        (!['ready', 'partial'].includes(file.parseState || '') || !['ps4', 'ps5'].includes(file.resourcePlatform || ''))
      )
        throw new Error('此资源尚未完成可验证的 PlayStation 包解析')
      if (file.resourcePlatform === 'ps5' && capabilities.platform === 'ps4') throw new Error('PS5 资源不能安装到 PS4')
      const url = await resourceDownload(file)
      if (!url) throw new Error('浏览器本地文件需要桌面/NAS 托管才能发送安装')
      let iconUrl: string | undefined
      const contentId = file.resourceMetadata?.contentId || file.paramSfo?.CONTENT_ID
      if (capabilities.platform === 'ps5' && file.icon0 && contentId) {
        try {
          iconUrl = await uploadPS5Icon(host.url, contentId, file.icon0)
        } catch {
          Notification.error('封面上传失败，继续提交安装')
        }
      }
      const submission: JobSubmission = {
        idempotencyKey: newId('install'),
        url,
        title: file.resourceMetadata?.title || file.paramSfo?.TITLE || file.basename,
        ...(contentId ? { contentId } : {}),
        ...(iconUrl ? { iconUrl } : {}),
      }
      const task: InstallTask = {
        file: { ...file, addons: undefined, patchs: undefined },
        idempotencyKey: submission.idempotencyKey,
        submission,
        hostId: host.id,
        capabilities,
        platform: capabilities.platform,
        title: submission.title!,
        ps4HostUrl: host.url,
        fileServerHostId: fileServerHostId || '',
        status: TaskStatus.INSTALLING,
        jobState: 'queued',
      }
      const previous = tasksRef.current
      persistTasks([task, ...previous])
      tasksRef.current = [task, ...previous]
      setInstallTasks((previous) => [task, ...previous])
      try {
        const job = await client.submit(submission)
        setInstallTasks((previous) =>
          previous.map((value) => (value.idempotencyKey === task.idempotencyKey ? applyJob(value, job) : value)),
        )
      } catch (error) {
        const rejected =
          error instanceof JobApiError &&
          error.status >= 400 &&
          error.status < 500 &&
          error.status !== 408 &&
          error.status !== 429
        setInstallTasks((previous) =>
          previous.map((value) =>
            value.idempotencyKey === task.idempotencyKey
              ? {
                  ...value,
                  ...(rejected ? { jobState: 'failed', status: TaskStatus.FAILED } : {}),
                  offline: !rejected,
                  errorMessage:
                    (rejected ? '主机拒绝提交：' : '响应未确认；保留幂等键，重连后核对：') + (error as Error).message,
                }
              : value,
          ),
        )
      }
    } catch (error) {
      Notification.error({ title: '发送安装失败', content: (error as Error).message })
    }
  }
  const handleChangeInstallTaskStatus = async (task: InstallTask, action: TaskActionType) => {
    if (action === TaskActionType.DELETE) {
      setInstallTasks((previous) => previous.filter((value) => taskKey(value) !== taskKey(task)))
      return
    }
    if (action === TaskActionType.RETRY) {
      if (!task.jobId || !canControlJob(task, 'retry')) {
        Notification.error('无法确认的安装不能重试，请先在主机核对')
        return
      }
      const idempotencyKey = newId('install')
      const submission = task.submission ? { ...task.submission, idempotencyKey } : undefined
      const retry: InstallTask = {
        ...task,
        jobId: undefined,
        taskId: undefined,
        contentId: undefined,
        progressInfo: undefined,
        errorMessage: undefined,
        lastSyncedAt: undefined,
        idempotencyKey,
        retryOfJobId: task.jobId,
        submission,
        status: TaskStatus.INSTALLING,
        jobState: 'queued',
      }
      try {
        persistTasks([retry, ...tasksRef.current])
        tasksRef.current = [retry, ...tasksRef.current]
        setInstallTasks((previous) => [retry, ...previous])
        const job = await new ConsoleJobsClient(task.ps4HostUrl).action(task.jobId, 'retry', idempotencyKey)
        setInstallTasks((previous) =>
          previous.map((value) => (value.idempotencyKey === idempotencyKey ? applyJob(value, job) : value)),
        )
      } catch (error) {
        const rejected =
          error instanceof JobApiError &&
          error.status >= 400 &&
          error.status < 500 &&
          error.status !== 408 &&
          error.status !== 429
        setInstallTasks((previous) =>
          previous.map((value) =>
            value.idempotencyKey === idempotencyKey
              ? {
                  ...value,
                  ...(rejected ? { jobState: 'failed', status: TaskStatus.FAILED } : {}),
                  offline: !rejected,
                  errorMessage: (error as Error).message,
                }
              : value,
          ),
        )
        Notification.error((error as Error).message)
      }
      return
    }
    const operation = action === TaskActionType.PAUSE ? 'pause' : action === TaskActionType.RESUME ? 'resume' : 'cancel'
    try {
      if (!task.jobId || !canControlJob(task, operation)) throw new Error('此操作在当前任务状态下不可用')
      const job = await new ConsoleJobsClient(task.ps4HostUrl).action(task.jobId, operation)
      setInstallTasks((previous) =>
        previous.map((value) => (taskKey(value) === taskKey(task) ? applyJob(value, job) : value)),
      )
    } catch (error) {
      Notification.error((error as Error).message)
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
