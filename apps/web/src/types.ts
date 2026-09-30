import { Ps4PkgParamSfo } from '@njzy/ps4-pkg-info/web'
import { FileStat as RawFileStat, WebDAVClientOptions } from 'webdav/web'

type BaseFileStat = RawFileStat & {
  resourceId?: string
  libraryId?: string
  libraryConnectionId?: string
  parseState?: string
  resourcePlatform?: string
  resourceKind?: string
  resourceMetadata?: import('@consolepkg/library').PackageMetadata
  fileVersion?: string
  coverAssetId?: string
  parseMessage?: string
  downloadUrl?: string
  icon0?: string
  paramSfo?: Ps4PkgParamSfo
}

export type FileStat = BaseFileStat & {
  addons?: BaseFileStat[]
  patchs?: BaseFileStat[]
}

export enum FileServerType {
  LibraryService = 'LibraryService',
  BrowserFiles = 'BrowserFiles',
  StaticFileServer = 'StaticFileServer',
  WebDAV = 'WebDAV',
}

export type WebDAVHost = {
  id: string
  type: FileServerType.WebDAV
  alias?: string
  recursiveQuery?: boolean
  url: string
  options?: WebDAVClientOptions
}

export type StaticFileServerHost = {
  id: string
  type: FileServerType.StaticFileServer
  alias?: string
  directoryPath: string
  port: number
  url: string
  preferredInterface?: string
  recursiveQuery?: boolean
}

export type FileServerHost = (
  | WebDAVHost
  | StaticFileServerHost
  | {
      id: string
      type: FileServerType.LibraryService | FileServerType.BrowserFiles
      alias?: string
      url: string
      recursiveQuery?: boolean
      directoryPath?: string
      port?: number
      preferredInterface?: string
    }
) & { token?: string; libraryId?: string; provision?: import('@consolepkg/library').SourceConfig }

export type PS4Host = {
  id: string
  alias?: string
  url: string
  platform?: 'ps4' | 'ps5'
}

export type ProgressInfo = {
  preparing_percent: number
  local_copy_percent: number
  rest_sec: number
  rest_sec_total: number
  num_index: number
  num_total: number
  length: number
  length_total: number
  transferred: number
  transferred_total: number
  error: number
  bits: number
  _percent: number
}

export enum TaskStatus {
  FAILED = 'Failed',
  UNKNOWN = 'Unknown',
  CANCELLED = 'Cancelled',
  PAUSED = 'Paused',
  INSTALLING = 'Installing',
  FINISHED = 'Finished',
}

export enum TaskActionType {
  RETRY = 'Retry',
  PAUSE = 'Pause',
  RESUME = 'Resume',
  CANCEL = 'Cancel',
  DELETE = 'Delete',
}

export type InstallTask = {
  file: FileStat
  taskId?: number
  jobId?: string
  hostId?: string
  idempotencyKey?: string
  retryOfJobId?: string
  jobState?: import('@/service/jobs').JobState
  submission?: import('@/service/jobs').JobSubmission
  capabilities?: import('@/service/jobs').JobCapabilities
  lastSyncedAt?: number
  offline?: boolean
  contentId?: string
  platform?: 'ps4' | 'ps5'
  nativeState?: string
  title: string
  ps4HostUrl: string
  fileServerHostId: string
  status: TaskStatus
  progressInfo?: ProgressInfo
  cancelToken?: string
  cleanupPending?: boolean
  errorMessage?: string
  sampleTime?: number
  sampleTransferred?: number
  downloadSpeed?: number
  speedHistory?: number[]
}
