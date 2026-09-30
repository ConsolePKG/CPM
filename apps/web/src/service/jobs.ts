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
export type Job = {
  jobId: string
  state: JobState
  platform: 'ps4' | 'ps5'
  title: string
  idempotencyKey: string
  nativeRef: { task_id?: number; content_id?: string }
  nativeState?: string
  progress: { transferred: number; total: number }
  error?: string
  errorCode?: number
}
export type JobSubmission = {
  idempotencyKey: string
  url: string
  contentId?: string
  title?: string
  iconUrl?: string
}
export type JobCapabilities = {
  protocolVersion: number
  platform: 'ps4' | 'ps5'
  jobs: boolean
  pause: boolean
  resume: boolean
  cancel: boolean
  retry?: boolean
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
      const response = await this.fetcher(`${this.address.replace(/\/$/, '')}/api/v1${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })
      const value = await response.json()
      if (!response.ok) throw new JobApiError(value.message || `CPI HTTP ${response.status}`, response.status)
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
  action(jobId: string, action: 'pause' | 'resume' | 'cancel' | 'retry', idempotencyKey?: string): Promise<Job> {
    return this.request(`/jobs/${encodeURIComponent(jobId)}/actions`, {
      action,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    })
  }
}
