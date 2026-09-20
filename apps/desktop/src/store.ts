import { defaultSettings } from 'common/constants/settings'
import { ipcRendererInvoke } from 'common/typedIpc'
import { ConfigStore } from 'common/types/configStore'
import { app } from 'electron'
import ElectronStore from 'electron-store'
import path from 'path'

class StoreManager {
  private static instance: StoreManager

  static getInstance() {
    if (!StoreManager.instance) {
      StoreManager.instance = new StoreManager()
    }
    return StoreManager.instance
  }

  // @ts-ignore
  configStore: ElectronStore<ConfigStore>
  // @ts-ignore
  cwd: string

  protected constructor() {
    ;(async () => {
      const cwd = await this.getCwd()
      this.cwd = cwd
      this.configStore = new ElectronStore<ConfigStore>({
        name: 'config',
        cwd,
        defaults: {
          settings: defaultSettings,
          ps4Hosts: [],
          webDavHosts: [],
          fileServerHosts: [],
        },
      })
    })()
  }

  async getCwd(): Promise<string> {
    const isDev = process.env.NODE_ENV === 'development'

    const devConfigDir = path.resolve(__dirname, '../../appDevConfig')
    if (isDev) {
      return devConfigDir
    }
    if (app === undefined) {
      return await ipcRendererInvoke('getPath', 'userData')
    } else {
      return app.getPath('userData')
    }
  }
}

export const storeManager = StoreManager.getInstance()
