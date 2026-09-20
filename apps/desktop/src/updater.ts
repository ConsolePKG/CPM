import axios from 'axios'
import { app, Notification, shell } from 'electron'
import { lt } from 'semver'

import { Ipc } from './ipc'
import { storeManager } from './store'

export interface UpdaterChannelData {
  message: string
  description?: string
  url?: string
}

const appVersion = app.getVersion()

const GithubReleaseApi = `https://api.github.com/repos/njzydark/PS4RPS/releases?per_page=8`

class Updater {
  private static instance: Updater

  static getInstance() {
    if (!Updater.instance) {
      Updater.instance = new Updater()
    }
    return Updater.instance
  }

  checkUpdate(manul = false, useSystemNotification = false) {
    console.log('check update')
    if (manul) {
      this.sendMessage(
        {
          message: 'Check update...',
        },
        useSystemNotification,
      )
    }
    this.checkUpdateFromGithub(manul, useSystemNotification)
  }

  protected async checkUpdateFromGithub(manul: boolean, useSystemNotification: boolean) {
    try {
      const { useBetaVersion } = storeManager.configStore.get('settings')
      const res =
        await axios.get<{ prerelease: boolean; draft: boolean; tag_name: string; html_url: string }[]>(GithubReleaseApi)
      if (res.status === 200) {
        const { data } = res
        const latest = data.find((item) => item.prerelease === false && item.draft === false)
        const latestBeta = data.find((item) => item.prerelease === true && item.draft === false)
        let updateInfo: ({ tag_name: string; html_url: string } & typeof latest) | null = null
        if (useBetaVersion) {
          if (latest && lt(appVersion, latest.tag_name)) {
            updateInfo = latest
          } else if (latestBeta && lt(appVersion, latestBeta.tag_name)) {
            updateInfo = latestBeta
          }
        } else {
          if (latest && lt(appVersion, latest.tag_name)) {
            updateInfo = latest
          }
        }
        if (updateInfo) {
          this.sendMessage(
            {
              message: `Has a new version`,
              description: `${updateInfo.tag_name}`,
              url: updateInfo.html_url,
            },
            useSystemNotification,
          )
        } else {
          manul &&
            this.sendMessage(
              {
                message: 'Current is latest version',
              },
              useSystemNotification,
            )
        }
      } else {
        manul &&
          this.sendMessage(
            {
              message: `Network error, please try again later`,
            },
            useSystemNotification,
          )
      }
    } catch (err) {
      console.error(`check update error: ${(err as Error).message}`)
      manul &&
        this.sendMessage(
          {
            message: `Check update failed`,
            description: (err as Error).message,
          },
          useSystemNotification,
        )
    }
  }

  protected sendMessage(channelData: UpdaterChannelData, useSystemNotification: boolean) {
    if (useSystemNotification) {
      const notification = new Notification({ title: channelData.message, body: channelData.description || '' })
      if (channelData.url) {
        notification.on('click', () => {
          shell.openExternal(channelData.url as string)
        })
      }
      notification.show()
    } else {
      Ipc.sendMessage('app-updater-message', channelData)
    }
  }
}

export const updater = Updater.getInstance()
