import { TaskStatus, type FileStat, type InstallTask, type PS4Host } from '@/types'
import type { Job, JobCapabilities } from '@/service/jobs'
import { sampleJobTransfer, transferPercent } from './taskProgress'

export const isAttempt = (job: Job) =>
  job.recordType !== 'legacy' &&
  !(job.recordType === undefined && job.idempotencyKey?.startsWith('historical:')) &&
  !job.supersededBy &&
  !job.deleted

export function applyJob(task: InstallTask, job: Job): InstallTask {
  // A delayed submission response must not overwrite a newer native sample.
  if (
    task.jobId === job.jobId &&
    task.nativeSampleId !== undefined &&
    ((!job.observation && !job.queryError && ['queued', 'submitting', 'accepted'].includes(job.state)) ||
      (job.observation &&
        task.nativeSessionId === job.observation.sessionId &&
        job.observation.sampleId < task.nativeSampleId))
  )
    return task
  const status =
    job.state === 'completed'
      ? TaskStatus.FINISHED
      : job.state === 'failed'
        ? TaskStatus.FAILED
        : job.state === 'cancelled'
          ? TaskStatus.CANCELLED
          : job.state === 'unknown' || job.activity === 'idle'
            ? TaskStatus.UNKNOWN
            : job.state === 'paused'
              ? TaskStatus.PAUSED
              : TaskStatus.INSTALLING
  const { remainingSeconds, ...sample } = sampleJobTransfer(task, job)
  return {
    ...task,
    jobId: job.jobId,
    submission: undefined,
    retryOfJobId: undefined,
    titleId: job.titleId || task.titleId,
    packageType: job.packageType || job.resource?.kind || task.packageType,
    queryError: job.queryError ? '主机状态暂时无法获取，保留最后成功的进度' : undefined,
    idempotencyKey: job.idempotencyKey || task.idempotencyKey,
    taskId: job.nativeRef.task_id !== undefined && job.nativeRef.task_id >= 0 ? job.nativeRef.task_id : undefined,
    contentId: job.nativeRef.content_id || job.contentId || task.contentId,
    platform: job.platform,
    title: job.title || task.file.resourceMetadata?.title || task.title,
    jobState: job.state,
    nativeState: job.nativeState,
    activity: job.activity,
    supersededBy: job.supersededBy,
    status,
    progressInfo: {
      preparing_percent: 0,
      local_copy_percent: 0,
      rest_sec: remainingSeconds,
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
    },
    offline: false,
    pendingSync: false,
    sourceName: job.resource?.sourceName || task.sourceName,
    lastObservedAt: job.observation ? Date.now() - job.observation.ageMs : undefined,
    lastSyncedAt: Date.now(),
    errorMessage: job.nativeStatusUnavailable
      ? '主机当前未返回安装状态，安装结果待核对。'
      : job.activity === 'idle' && job.state === 'unknown'
        ? '主机当前没有活跃安装；此次安装结果未确认，可从游戏库重新安装。'
        : job.error || undefined,
    ...sample,
  }
}

export function restoreJobTasks(
  previous: InstallTask[],
  host: PS4Host,
  jobs: Job[],
  capabilities: JobCapabilities,
  files = new Map<string, FileStat>(),
) {
  const belongs = (task: InstallTask) => task.hostId === host.id || task.ps4HostUrl === host.url
  const visible = jobs.filter(isAttempt)
  // The complete CPI list is authoritative for records with a job ID.
  // Local requests without an ID are retained until their response is confirmed.
  const result = previous.filter(
    (task) => !belongs(task) || !task.jobId || visible.some((job) => job.jobId === task.jobId),
  )
  for (const job of visible) {
    const index = result.findIndex(
      (task) => belongs(task) && (task.jobId === job.jobId || task.idempotencyKey === job.idempotencyKey),
    )
    const existing = index >= 0 ? result[index] : undefined
    const cached = existing?.file
    const matching =
      cached &&
      (!job.resource?.libraryId || cached.libraryId === job.resource.libraryId) &&
      (!job.resourceId || cached.resourceId === job.resourceId) &&
      (!job.resource?.fileVersion || cached.fileVersion === job.resource.fileVersion)
    const file = files.get(job.jobId) ||
      (matching ? cached : undefined) || {
        resourceId: job.resourceId,
        libraryId: job.resource?.libraryId,
        fileVersion: job.resource?.fileVersion,
        resourceKind: job.packageType || job.resource?.kind,
        resourcePlatform: job.resource?.platform,
        resourceMetadata: job.resource?.platform
          ? {
              platform: job.resource.platform,
              format: 'ps4-pkg',
              kind: job.resource.kind || 'unknown',
              title: job.title,
              contentId: job.contentId || job.nativeRef.content_id,
              titleId: job.titleId,
              version: job.resource.version,
              raw: {},
            }
          : undefined,
        filename: job.resource?.filename || `cpi-job-${job.jobId}`,
        basename: job.title || job.nativeRef.content_id || `安装任务 ${job.jobId}`,
        type: 'file' as const,
        size: job.resource?.size || job.progress.total,
        etag: '',
        lastmod: '',
      }
    const task = applyJob(
      {
        ...existing,
        file,
        hostId: host.id,
        capabilities,
        title: job.title || file.resourceMetadata?.title || existing?.title || file.basename,
        ps4HostUrl: host.url,
        fileServerHostId: file.libraryConnectionId || existing?.fileServerHostId || '',
        status: TaskStatus.UNKNOWN,
      },
      job,
    )
    if (index >= 0) result[index] = task
    else result.unshift(task)
  }
  return result.filter((task) => !task.supersededBy)
}
