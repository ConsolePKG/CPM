export type JobState =
  | 'queued'
  | 'submitting'
  | 'accepted'
  | 'transferring'
  | 'installing'
  | 'completed'
  | 'paused'
  | 'failed'
  | 'cancelled'
  | 'unknown'
export type JobResource = {
  libraryId?: string
  fileVersion?: string
  filename?: string
  size?: number
  kind?: 'base' | 'patch' | 'dlc' | 'unknown'
  version?: string
  sourceName?: string
  platform?: 'ps4' | 'ps5'
}
export type Job = {
  jobId: string
  state: JobState
  platform: 'ps4' | 'ps5'
  title: string
  idempotencyKey: string
  nativeRef: { task_id?: number; content_id?: string }
  nativeState?: string
  nativeStatusUnavailable?: boolean
  progress: { transferred: number; total: number }
  observation?: { sampleId: number; sampledAt: number; ageMs: number; sessionId?: number }
  queryError?: { message: string; nativeCode: number }
  titleId?: string
  packageType?: JobResource['kind']
  error?: string
  errorCode?: number
  deleted?: boolean
  recordType?: 'legacy' | 'attempt'
  activity?: 'active' | 'idle' | 'unknown'
  supersededBy?: string
  contentId?: string
  resourceId?: string
  resource?: JobResource
}
export type JobSubmission = {
  idempotencyKey: string
  url: string
  contentId?: string
  titleId?: string
  packageType?: JobResource['kind']
  title?: string
  iconUrl?: string
  resourceId?: string
  resource?: JobResource
}
export type JobCapabilities = {
  protocolVersion: number
  platform: 'ps4' | 'ps5'
  jobs: boolean
  pause: boolean
  resume: boolean
  cancel: boolean
  retry?: boolean
  deleteHistory?: boolean
  completionVerified: boolean
}
export class JobApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}
export class ConsoleJobsClient {
  constructor(
    readonly address: string,
    private fetcher: typeof fetch = (input, init) => globalThis.fetch(input, init),
  ) {}
  private async request(path: string, body?: unknown) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    try {
      let response: Response
      try {
        response = await this.fetcher(`${this.address.replace(/\/$/, '')}/api/v1${path}`, {
          method: body === undefined ? 'GET' : 'POST',
          headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        })
      } catch {
        throw new Error(
          controller.signal.aborted
            ? `CPI 请求超时（${this.address}），请检查主机安装服务`
            : `无法连接 CPI（${this.address}），请确认安装服务已启动；PS5 请先通过 ELF loader 发送 CPI`,
        )
      }
      const value = await response.json().catch(() => {
        throw new Error(`CPI 返回了无效响应（HTTP ${response.status}），请检查安装服务版本`)
      })
      if (!response.ok)
        throw new JobApiError(
          value.message === 'Content has an active installation'
            ? '此游戏正在提交或安装，请等待当前任务结束'
            : value.message === 'Installation record was deleted; submit a new request key'
              ? '此安装记录已删除，请从游戏库重新发送安装'
              : value.message || `CPI HTTP ${response.status}`,
          response.status,
        )
      return value
    } finally {
      clearTimeout(timer)
    }
  }
  capabilities(): Promise<JobCapabilities> {
    return this.request('/capabilities')
  }
  submit(submission: JobSubmission): Promise<Job> {
    return this.request('/jobs', submission)
  }
  get(jobId: string): Promise<Job> {
    return this.request(`/jobs/${encodeURIComponent(jobId)}`)
  }
  list(cursor?: string): Promise<{ items: Job[]; nextCursor?: string }> {
    return this.request(`/jobs${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`)
  }
  remove(jobId: string): Promise<{ jobId: string; deleted: true }> {
    return this.request(`/jobs/${encodeURIComponent(jobId)}/actions`, { action: 'delete' })
  }
  action(jobId: string, action: 'pause' | 'resume' | 'cancel' | 'retry', idempotencyKey?: string): Promise<Job> {
    return this.request(`/jobs/${encodeURIComponent(jobId)}/actions`, {
      action,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    })
  }
}
