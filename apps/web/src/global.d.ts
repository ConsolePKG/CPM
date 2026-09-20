import { IElectronAPI } from 'common/types'

declare global {
  interface Window {
    electron?: IElectronAPI
  }

  const _app_version: string
}
