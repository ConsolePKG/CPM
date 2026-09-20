import { ipcMainHandle, ipcMainOn } from 'common/typedIpc'
import { app, BrowserWindow, dialog } from 'electron'
import fs from 'fs'

import { Logger } from './logger'
import { staticServerManager } from './staticServerManager'
import { storeManager } from './store'
import { updater } from './updater'
import { getAvailableInterfaces, getIp } from './utils'

export class Ipc {
  static win: BrowserWindow

  private static instance: Ipc

  static getInstance() {
    if (!Ipc.instance) {
      Ipc.instance = new Ipc()
    }
    return Ipc.instance
  }

  static sendMessage(channel: string, channelData?: any) {
    if (BrowserWindow.getAllWindows().length > 0) {
      Ipc.win.webContents.send(channel, channelData)
    }
  }

  logger: Logger

  protected constructor() {
    this.logger = Logger.getInstance()

    this.init()
  }

  protected init() {
    this.initWebDavServer()

    ipcMainHandle('getAppInfo', async () => {
      const version = app.getVersion()
      const path = app.getAppPath()
      const name = app.getName()
      return {
        version,
        path,
        name,
      }
    })

    ipcMainOn('openDirectoryDialog', async (event) => {
      const { filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory'],
      })
      // eslint-disable-next-line prefer-destructuring
      event.returnValue = filePaths[0]
    })

    ipcMainHandle('createStaticFileServer', async (_, { directoryPath, port, preferredInterface }) => {
      try {
        const res = await staticServerManager.createServer({ directoryPath, port })
        const ip = preferredInterface ?? getIp()
        if (res && ip) {
          return {
            url: `http://${ip}:${port}`,
          }
        }
      } catch (err) {
        return {
          errorMessage: `Create WebDAV server failed: ${(err as Error).message}`,
        }
      }
    })

    ipcMainHandle('getAvailableInterfaces', async () => {
      try {
        const ifaces = getAvailableInterfaces()
        if (ifaces) {
          return ifaces.map((ifc) => {
            return { ipv4: ifc?.address || '' }
          })
        }
      } catch (err) {
        return {
          errorMessage: `Get AvailableInterfaces failed: ${(err as Error).message}`,
        }
      }
      return []
    })

    ipcMainHandle('getPath', async (_, path) => {
      return app.getPath(path)
    })

    ipcMainHandle('chnageWindowStatus', async (_, status) => {
      if (status === 'minimize') {
        Ipc.win.minimize()
      }
      if (status === 'maximize') {
        if (Ipc.win.isMaximized()) {
          Ipc.win.unmaximize()
        } else {
          Ipc.win.maximize()
        }
      }
      if (status === 'close') {
        Ipc.win.close()
      }
    })

    ipcMainHandle('openDevTools', async () => {
      Ipc.win.webContents.openDevTools()
    })

    ipcMainHandle('openAppLog', async () => {
      this.logger.open()
    })

    ipcMainHandle('checkUpdate', async () => {
      await updater.checkUpdate(true, true)
    })
  }

  protected async initWebDavServer() {
    try {
      const { fileServerHosts, curFileServerHostId } = storeManager.configStore.store
      const curHost = fileServerHosts.find((item) => item.id === curFileServerHostId)
      if (curHost?.port && curHost?.directoryPath && fs.existsSync(curHost?.directoryPath)) {
        await staticServerManager.createServer({ directoryPath: curHost.directoryPath, port: curHost.port })
        console.log(`Init static file server success: ${curHost.directoryPath}`)
      }
    } catch (err) {
      console.error(`Init static file server failed: ${(err as Error).message}`)
    }
  }
}
