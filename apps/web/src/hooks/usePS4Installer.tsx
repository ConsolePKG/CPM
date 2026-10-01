import { Notification } from '@/components/ui'
import { useEffect, useRef, useState } from 'react'
import { usePS4HostForm } from './useHostForms'
import { canControlJob, canDeleteTask, taskKey } from './taskProgress'
import { FileStat, InstallTask, PS4Host, TaskActionType, TaskStatus } from '@/types'
import { getInitConfigFromStore, updateConfigStore } from '@/utils'
import { isPlayStationBrowser } from '@/utils/browser'
import { initializeLocalConsole, localConsoleSetupKey } from './localConsole'
import { ConsoleJobsClient, JobApiError, type Job, type JobSubmission } from '@/service/jobs'
import { uploadPS5Icon } from '@/service/ps5'
import { libraryCover, resourceDownload, resolveLibraryFile } from '@/library/runtime'
import { applyJob, isAttempt, restoreJobTasks } from './taskRecovery'
import { newId } from '@consolepkg/library'
import { taskActionFeedback } from '@/utils/taskPresentation'

const storageKey = 'cpm-console-jobs-v1'
const installRequestKey = (file: FileStat, host: string) =>
  JSON.stringify([host, file.libraryId || file.libraryConnectionId, file.resourceId || file.filename, file.fileVersion])
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
function loadTasks(): InstallTask[] {
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      const tasks = JSON.parse(saved)
      return Array.isArray(tasks)
        ? tasks
            .filter((task) => !task.idempotencyKey?.startsWith('historical:') && !task.supersededBy)
            .map((task) => ({
              ...task,
              offline: true,
              pendingSync: true,
              downloadSpeed: undefined,
              sampleTime: undefined,
              sampleTransferred: undefined,
              speedHistory: [],
            }))
        : []
    }
    const legacy = JSON.parse(localStorage.getItem('cpm-ps5-install-tasks') || '[]')
    if (!Array.isArray(legacy)) return []
    localStorage.setItem('cpm-console-jobs-migration-backup', JSON.stringify(legacy))
    return []
  } catch {
    return []
  }
}
export const usePS4Installer = (fileServerHostId?: string) => {
  const [initial] = useState(useLocalConsoleDefaults)
  const [ps4Hosts, setPs4Hosts] = useState<PS4Host[]>(initial.hosts)
  const [curSelectPs4HostId, setCurSelectPs4HostId] = useState<string | undefined>(initial.selected)
  const [installTasks, setInstallTasks] = useState<InstallTask[]>(loadTasks)
  const [totalSpeedHistory, setTotalSpeedHistory] = useState<number[]>([])
  const sendingRequests = useRef(new Set<string>())
  const [sendingInstalls, setSendingInstalls] = useState(new Set<string>())
  const actionRequests = useRef(new Set<string>())
  const [pendingActions, setPendingActions] = useState<Record<string, TaskActionType>>({})
  const libraryChecks = useRef(new Map<string, { pending: boolean; nextAt: number }>())
  const listRevision = useRef(0)
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
    const checking = new Set<string>()
    const poll = async () => {
      await Promise.all(
        ps4Hosts.map(async (host) => {
          if (checking.has(host.id)) return
          checking.add(host.id)
          const snapshot = tasksRef.current
          const revision = listRevision.current
          try {
            const client = new ConsoleJobsClient(host.url)
            const capabilities = await client.capabilities()
            const jobs: Job[] = []
            let cursor: string | undefined
            do {
              const page = await client.list(cursor)
              jobs.push(...page.items)
              cursor = page.nextCursor
            } while (cursor && !stopped)
            if (stopped || revision !== listRevision.current) return
            setInstallTasks((previous) => {
              if (revision !== listRevision.current) return previous
              const refreshed = previous
              // A submission created during this request may not be in its snapshot.
              const concurrent = refreshed.filter(
                (task) =>
                  !snapshot.some((old) => taskKey(old) === taskKey(task)) &&
                  !jobs.some((job) => task.jobId === job.jobId || task.idempotencyKey === job.idempotencyKey),
              )
              return [
                ...restoreJobTasks(
                  refreshed.filter((task) => !concurrent.includes(task)),
                  host,
                  jobs,
                  capabilities,
                ),
                ...concurrent,
              ]
            })
            // Library enrichment is independent of console synchronization.
            // Slow/offline sources must not delay the next CPI refresh.
            for (const job of jobs.filter(isAttempt)) {
              const key = `${host.url}#${job.jobId}`
              const check = libraryChecks.current.get(key)
              if (check?.pending || (check && check.nextAt > Date.now())) continue
              libraryChecks.current.set(key, { pending: true, nextAt: 0 })
              void (async () => {
                let file: FileStat | undefined
                try {
                  const previous = tasksRef.current.find(
                    (task) => task.ps4HostUrl === host.url && task.jobId === job.jobId,
                  )
                  const original = job.resourceId
                    ? ({
                        ...previous?.file,
                        resourceId: job.resourceId,
                        libraryId: job.resource?.libraryId || previous?.file.libraryId,
                        fileVersion: job.resource?.fileVersion || previous?.file.fileVersion,
                      } as FileStat)
                    : previous?.file
                  file = await resolveLibraryFile(original, job.nativeRef.content_id || job.contentId, true)
                } catch {
                } finally {
                  libraryChecks.current.set(key, { pending: false, nextAt: Date.now() + 10000 })
                }
                if (!stopped)
                  setInstallTasks((tasks) =>
                    tasks.map((task) =>
                      task.ps4HostUrl === host.url && task.jobId === job.jobId
                        ? {
                            ...task,
                            resourceUnavailable: !file,
                            sourceName:
                              task.sourceName ||
                              (file &&
                                (
                                  getInitConfigFromStore('fileServerHosts', []) as import('@/types').FileServerHost[]
                                ).find((source) => source.id === file.libraryConnectionId)?.alias),
                            ...(file
                              ? { file, fileServerHostId: file.libraryConnectionId || task.fileServerHostId }
                              : {}),
                          }
                        : task,
                    ),
                  )
              })()
            }
            // Check the authoritative list before replaying an unconfirmed request.
            const pending = snapshot.filter(
              (task) =>
                task.ps4HostUrl === host.url &&
                !task.jobId &&
                task.jobState !== 'failed' &&
                (task.submission || task.retryOfJobId) &&
                !jobs.some((job) => job.idempotencyKey === task.idempotencyKey) &&
                (!task.submittedAt || Date.now() - task.submittedAt >= 15000),
            )
            for (const task of pending) {
              if (stopped) break
              try {
                if (!task.submittedAt || Date.now() - task.submittedAt >= 24 * 60 * 60 * 1000)
                  throw new JobApiError('请求核对期限已过，安装结果未确认；请在主机检查后重新发送', 410)
                const job = task.retryOfJobId
                  ? await client.action(task.retryOfJobId, 'retry', task.idempotencyKey)
                  : await client.submit(task.submission!)
                if (!stopped)
                  setInstallTasks((tasks) =>
                    tasks.map((value) =>
                      value.idempotencyKey === task.idempotencyKey && !value.jobId ? applyJob(value, job) : value,
                    ),
                  )
              } catch (error) {
                const rejected =
                  error instanceof JobApiError &&
                  error.status >= 400 &&
                  error.status < 500 &&
                  error.status !== 408 &&
                  error.status !== 429
                if (!stopped)
                  setInstallTasks((tasks) =>
                    tasks.map((value) =>
                      value.idempotencyKey === task.idempotencyKey && !value.jobId
                        ? {
                            ...value,
                            ...(rejected
                              ? {
                                  jobState: error instanceof JobApiError && error.status === 410 ? 'unknown' : 'failed',
                                  status:
                                    error instanceof JobApiError && error.status === 410
                                      ? TaskStatus.UNKNOWN
                                      : TaskStatus.FAILED,
                                  submission: undefined,
                                  retryOfJobId: undefined,
                                  offline: false,
                                  pendingSync: false,
                                }
                              : {}),
                            errorMessage: (error as Error).message,
                            downloadSpeed: undefined,
                          }
                        : value,
                    ),
                  )
              }
            }
          } catch (error) {
            if (!stopped)
              setInstallTasks((tasks) =>
                tasks.map((task) =>
                  task.ps4HostUrl === host.url
                    ? {
                        ...task,
                        offline: true,
                        pendingSync: false,
                        errorMessage: (error as Error).message,
                        downloadSpeed: undefined,
                        sampleTime: undefined,
                        sampleTransferred: undefined,
                        progressInfo: task.progressInfo ? { ...task.progressInfo, rest_sec: 0 } : undefined,
                      }
                    : task,
                ),
              )
          } finally {
            checking.delete(host.id)
          }
        }),
      )
      if (!stopped) {
        const total = tasksRef.current.reduce(
          (sum, task) => sum + (!task.offline && task.status === TaskStatus.INSTALLING ? task.downloadSpeed || 0 : 0),
          0,
        )
        setTotalSpeedHistory((previous) => [...previous.slice(-19), total])
      }
    }
    void poll()
    const timer = window.setInterval(poll, 1000)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [ps4Hosts])
  const handleInstall = async (file: FileStat, targetUrl?: string) => {
    const host = ps4Hosts.find((host) => (targetUrl ? host.url === targetUrl : host.id === curSelectPs4HostId))
    if (!host) {
      openHostForm()
      return
    }
    const requestKey = installRequestKey(file, host.url)
    if (sendingRequests.current.has(requestKey)) return
    sendingRequests.current.add(requestKey)
    setSendingInstalls(new Set(sendingRequests.current))
    const title = file.resourceMetadata?.title || file.paramSfo?.TITLE || file.basename
    const notice = Notification.loading({ title: '正在发送安装任务…', content: title })
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
      if (capabilities.platform === 'ps5' && contentId) {
        try {
          const icon = file.icon0 || (await libraryCover(file))?.bytes
          if (icon) iconUrl = await uploadPS5Icon(host.url, contentId, icon)
        } catch {
          Notification.error('封面上传失败，继续提交安装')
        }
      }
      const category = file.paramSfo?.CATEGORY
      const kind =
        (file.resourceKind && file.resourceKind !== 'unknown' ? file.resourceKind : undefined) ||
        (category === 'gd' || category === 'gdn'
          ? 'base'
          : category === 'gp' || category === 'gpn'
            ? 'patch'
            : category === 'ac'
              ? 'dlc'
              : 'unknown')
      const packageType = ['base', 'patch', 'dlc'].includes(kind) ? (kind as 'base' | 'patch' | 'dlc') : 'unknown'
      const submission: JobSubmission = {
        idempotencyKey: newId('install'),
        titleId: file.resourceMetadata?.titleId || file.paramSfo?.TITLE_ID,
        packageType,
        url,
        title: file.resourceMetadata?.title || file.paramSfo?.TITLE || file.basename,
        ...(contentId ? { contentId } : {}),
        ...(iconUrl ? { iconUrl } : {}),
        ...(file.resourceId
          ? {
              resourceId: file.resourceId,
              resource: {
                libraryId: file.libraryId,
                fileVersion: file.fileVersion,
                filename: file.basename.slice(0, 255),
                size: file.size,
                kind: packageType,
                version: file.resourceMetadata?.version,
                platform:
                  file.resourcePlatform === 'ps4' || file.resourcePlatform === 'ps5'
                    ? file.resourcePlatform
                    : undefined,
                sourceName: (getInitConfigFromStore('fileServerHosts', []) as import('@/types').FileServerHost[])
                  .find((source) => source.id === file.libraryConnectionId)
                  ?.alias?.slice(0, 128),
              },
            }
          : {}),
      }
      const task: InstallTask = {
        file: { ...file, addons: undefined, patchs: undefined },
        idempotencyKey: submission.idempotencyKey,
        submission,
        submittedAt: Date.now(),
        titleId: submission.titleId,
        packageType,
        hostId: host.id,
        capabilities,
        platform: capabilities.platform,
        title: submission.title!,
        ps4HostUrl: host.url,
        fileServerHostId: file.libraryConnectionId || fileServerHostId || '',
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
        Notification.update(notice, 'success', {
          title: '安装任务已发送',
          content: `${title} · 可在安装任务中查看进度`,
        })
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
                  ...(rejected ? { jobState: 'failed', status: TaskStatus.FAILED, submission: undefined } : {}),
                  offline: !rejected,
                  errorMessage:
                    (rejected ? '主机拒绝提交：' : '响应未确认；保留幂等键，重连后核对：') + (error as Error).message,
                }
              : value,
          ),
        )
        Notification.update(notice, rejected ? 'error' : 'info', {
          title: rejected ? '主机拒绝了安装任务' : '正在确认主机是否已接收',
          content: (error as Error).message,
        })
      }
    } catch (error) {
      Notification.update(notice, 'error', { title: '发送安装失败', content: (error as Error).message })
    } finally {
      sendingRequests.current.delete(requestKey)
      setSendingInstalls(new Set(sendingRequests.current))
    }
  }
  const handleChangeInstallTaskStatus = async (task: InstallTask, action: TaskActionType) => {
    const key = taskKey(task)
    if (actionRequests.current.has(key)) return
    actionRequests.current.add(key)
    setPendingActions((previous) => ({ ...previous, [key]: action }))
    const feedback = taskActionFeedback[action]
    const notice = Notification.loading({ title: feedback.pending, content: task.title || task.file.basename })
    try {
      if (action === TaskActionType.DELETE) {
        if (!canDeleteTask(task)) throw new Error('请先在主机结束当前安装，再删除记录')
        if (task.jobId) {
          if (!task.capabilities?.deleteHistory) throw new Error('请更新 CPI 后删除主机历史记录')
          await new ConsoleJobsClient(task.ps4HostUrl).remove(task.jobId)
        }
        listRevision.current++
        const next = tasksRef.current.filter((value) => taskKey(value) !== taskKey(task))
        persistTasks(next)
        tasksRef.current = next
        setInstallTasks(next)
        Notification.update(notice, 'success', { title: feedback.success, content: task.title })
        return
      }
      if (action === TaskActionType.RETRY) {
        if (!canControlJob(task, 'retry')) throw new Error('当前任务正在进行，或主机尚未连接')
        const file = await resolveLibraryFile(
          { ...task.file, resourceKind: task.packageType || task.file.resourceKind },
          task.contentId,
        )
        if (!file) throw new Error('请连接包含此游戏的资源库，再重新安装')
        Notification.remove(notice)
        await handleInstall(file, task.ps4HostUrl)
        return
      }
      const operation =
        action === TaskActionType.PAUSE ? 'pause' : action === TaskActionType.RESUME ? 'resume' : 'cancel'
      if (!task.jobId || !canControlJob(task, operation)) throw new Error('此操作在当前任务状态下不可用')
      const job = await new ConsoleJobsClient(task.ps4HostUrl).action(task.jobId, operation)
      setInstallTasks((previous) =>
        previous.map((value) => (taskKey(value) === taskKey(task) ? applyJob(value, job) : value)),
      )
      Notification.update(notice, 'success', { title: feedback.success, content: task.title || task.file.basename })
    } catch (error) {
      Notification.update(notice, 'error', { title: feedback.error, content: (error as Error).message })
    } finally {
      actionRequests.current.delete(key)
      setPendingActions((previous) => {
        const next = { ...previous }
        delete next[key]
        return next
      })
    }
  }
  return {
    installTasks,
    totalSpeedHistory,
    handleInstall,
    isSendingInstall: (file: FileStat, targetUrl?: string) => {
      const host = ps4Hosts.find((host) => (targetUrl ? host.url === targetUrl : host.id === curSelectPs4HostId))
      return !!host && sendingInstalls.has(installRequestKey(file, host.url))
    },
    pendingActions,
    ps4Hosts,
    curSelectPs4HostId,
    setPs4Hosts,
    setCurSelectPs4HostId,
    handleChangeInstallTaskStatus,
  }
}
