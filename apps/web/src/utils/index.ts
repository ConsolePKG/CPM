import { ConfigStore } from 'common/types/configStore'

import { FileStat } from '@/types'

export const formatFileSize = (size: number) => {
  const KB = 1024
  const MB = KB * 1024
  const GB = MB * 1024
  if (size < MB) {
    return `${(size / KB).toFixed(1)} KB`
  } else if (size < GB) {
    return `${(size / MB).toFixed(1)} MB`
  } else {
    return `${(size / GB).toFixed(1)} GB`
  }
}

export const getInitConfigFromStore = <T extends keyof ConfigStore>(key: T, defaultValue: ConfigStore[T]) => {
  try {
    if (window.electron) {
      return window.electron.configStore.get(key) || defaultValue
    } else {
      return JSON.parse(localStorage.getItem(key) as string) || defaultValue
    }
  } catch (err) {
    return defaultValue
  }
}

export const updateConfigStore = <T extends keyof ConfigStore>(key: T, value: ConfigStore[T]) => {
  try {
    if (window.electron) {
      return window.electron.configStore.set(key, value)
    } else {
      return localStorage.setItem(key, JSON.stringify(value))
    }
  } catch (err) {
    console.log(`update config error: ${(err as Error).message}`)
  }
}

export const isInPS4Browser = window.navigator.userAgent.includes('PlayStation 4')

const blackList = ['.DS_Store', '@eaDir', '._.DS_Store']

export const sortServerFiles = (files: FileStat[]): FileStat[] => {
  return (
    files
      .filter((item) => {
        if (item.type === 'directory' && !blackList.includes(item.basename)) {
          return true
        } else if (item.type === 'file' && item.basename.endsWith('.pkg')) {
          return true
        } else {
          return false
        }
      })
      ?.sort((a, b) => {
        const reg = /[\u4e00-\u9fa5]/
        const aName = a.basename
        const bName = b.basename
        if (reg.test(aName) && reg.test(bName)) {
          return aName.localeCompare(bName)
        } else {
          if (reg.test(aName) && !reg.test(bName)) {
            return 1
          } else if (reg.test(bName) && !reg.test(aName)) {
            return -1
          } else {
            return aName > bName ? 1 : -1
          }
        }
      })
      ?.sort((a, b) => {
        const aType = a.type
        const bType = b.type
        if (aType === 'directory' && bType !== 'directory') {
          return -1
        } else if (aType !== 'directory' && bType === 'directory') {
          return 1
        }
        return 0
      }) || []
  )
}

export const formatPkgName = (record?: FileStat, displayPkgRawTitle = false) => {
  if (!record) {
    return '-'
  }
  const formattedName =
    record.basename
      .split('/')
      .pop()
      ?.replace(/\.pkg$/i, '') || record.basename.replace(/\.pkg$/i, '')
  if (displayPkgRawTitle) {
    return record.paramSfo?.TITLE || formattedName
  }
  return formattedName
}
