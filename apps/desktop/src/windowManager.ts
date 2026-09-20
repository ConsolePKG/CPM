import { app, BrowserWindow } from 'electron'
import path from 'path'

import { Ipc } from './ipc'

const isDev = process.env.NODE_ENV === 'development'

export class WindowManager {
  private static instance: WindowManager

  static getInstance() {
    if (!WindowManager.instance) {
      WindowManager.instance = new WindowManager()
    }
    return WindowManager.instance
  }

  mainWindow?: BrowserWindow
  isQuitting?: boolean

  createWindow(): BrowserWindow {
    const window = new BrowserWindow({
      minWidth: 800,
      minHeight: 600,
      width: 800,
      height: 600,
      titleBarStyle: 'default',
      autoHideMenuBar: true,
      frame: true,
      webPreferences: {
        preload: path.join(__dirname, './preload.js'),
        nodeIntegration: true,
        webSecurity: false,
        // enableRemoteModule: true
      },
    })

    window.on('close', (evnet) => {
      if (!this.isQuitting && process.platform === 'darwin') {
        evnet.preventDefault()
        window.hide()
      }
    })

    if (isDev) {
      window.loadURL(`http://localhost:${process.env.RENDERER_DEV_PORT}`)
    } else {
      window.loadFile(path.resolve(__dirname, '../renderer/index.html'))
    }

    return window
  }

  showWindow() {
    app?.dock?.show()
    if (BrowserWindow.getAllWindows().length === 0) {
      this.mainWindow = this.createWindow()
      Ipc.win = this.mainWindow
    } else {
      this.mainWindow?.show()
    }
  }

  handleSecondInstance() {
    if (this.mainWindow && BrowserWindow.getAllWindows().length !== 0) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore()
      }
      this.mainWindow.focus()
    }
  }
}
