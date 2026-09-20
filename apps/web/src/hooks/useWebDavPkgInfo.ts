import { getPs4PkgInfo, Ps4PkgParamSfo } from '@njzy/ps4-pkg-info/web'
import { SetStateAction, useEffect, useState } from 'react'

import { FileStat } from '@/types'

type Options = {
  setFileServerFiles: (value: SetStateAction<FileStat[]>) => void
}

export const useWebDavPkgInfo = ({ setFileServerFiles }: Options) => {
  const [pkgInfoData, setPkgInfoData] = useState<{ name: string; icon0?: string; paramSfo?: Ps4PkgParamSfo }[]>([])
  const [pkgInfoDataLoading, setPkgInfoDataLoading] = useState(false)

  const getWebDavPkgFileInfo = async (data: FileStat[]) => {
    try {
      const promises = data.map(async (item) => {
        try {
          const res = await getPs4PkgInfo(item.downloadUrl!)
          if (res) {
            const url = res.icon0Raw ? window.URL.createObjectURL(new Blob([new Uint8Array(res.icon0Raw)])) : undefined
            const newData = {
              name: item.basename,
              icon0: url,
              paramSfo: res.paramSfo,
            }
            setPkgInfoData((pre) => {
              const curData = pkgInfoData.find((cache) => cache.name === item.basename)
              if (curData) {
                Object.assign(curData, newData)
                return [...pre]
              } else {
                pre.push(newData)
              }
              return [...pre]
            })
          }
        } catch (err) {
          return
        }
      })
      setPkgInfoDataLoading(true)
      await Promise.all(promises)
    } catch (err) {
      console.error('getWebDavPkgFileInfo', err)
    } finally {
      setPkgInfoDataLoading(false)
    }
  }

  useEffect(() => {
    if (pkgInfoData.length) {
      setFileServerFiles((pre) => {
        return pre.map((item) => {
          const curCache = pkgInfoData.find((cache) => cache.name === item.basename)
          if (curCache) {
            item.icon0 = curCache.icon0
            item.paramSfo = curCache.paramSfo
          }
          return item
        })
      })
    }
  }, [pkgInfoData])

  return {
    getWebDavPkgFileInfo,
    pkgInfoData,
    pkgInfoDataLoading,
  }
}
