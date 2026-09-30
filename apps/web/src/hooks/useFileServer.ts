import { Notification } from '@/components/ui'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FileServerHost, FileServerType, FileStat } from '@/types'
import { getInitConfigFromStore, sortServerFiles, updateConfigStore } from '@/utils'
import { connectLibrary, disconnectLibrary, libraryPresentation } from '@/library/runtime'

export const useFileServer = ({
  aggregationMode,
}: {
  forceWebDavDownloadLinkToHttp?: boolean
  aggregationMode?: boolean
}) => {
  const [fileServerHosts, setFileServerHosts] = useState<FileServerHost[]>(() =>
    getInitConfigFromStore('fileServerHosts', []),
  )
  const [curFileServerHostId, setCurFileServerHostId] = useState<string | undefined>(() =>
    getInitConfigFromStore('curFileServerHostId', undefined),
  )
  const curHost = useMemo(
    () => fileServerHosts.find((host) => host.id === curFileServerHostId),
    [fileServerHosts, curFileServerHostId],
  )
  const [fileServerFiles, setFileServerFiles] = useState<FileStat[]>([])
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(false)
  const [isFileServerReady, setIsFileServerReady] = useState(true)
  const [searchKeyWord, setSearchKeyWord] = useState('')
  const [paths, setPaths] = useState<string[]>([])
  const generation = useRef(0)
  const webDavClient = useRef(undefined)
  useEffect(() => {
    updateConfigStore('fileServerHosts', fileServerHosts)
    updateConfigStore('curFileServerHostId', curFileServerHostId)
  }, [fileServerHosts, curFileServerHostId])
  const activate = async (host: FileServerHost) => {
    if (pending) return
    setPending(true)
    setIsFileServerReady(false)
    try {
      let selected = host
      disconnectLibrary(host.id)
      if (host.type === FileServerType.StaticFileServer && window.electron) {
        const response = await window.electron.createStaticFileServer({
          directoryPath: host.directoryPath,
          port: host.port,
          preferredInterface: host.preferredInterface,
        })
        if (!response?.url) throw new Error(response?.errorMessage || '启动资源库失败')
        selected = { ...host, url: response.url, token: response.token, libraryId: response.libraryId }
      }
      const connection = await connectLibrary(selected)
      selected = { ...selected, libraryId: connection.libraryId }
      if (connection.sessionOnly) Notification.error('浏览器存储不可用：当前为会话资源库，关闭页面后索引不会保留')
      setFileServerHosts((old) => old.map((item) => (item.id === selected.id ? selected : item)))
      setPaths([])
      setFileServerFiles([])
      setCurFileServerHostId(selected.id)
    } catch (error) {
      Notification.error({ title: '连接资源库失败', content: (error as Error).message })
    } finally {
      setPending(false)
      setIsFileServerReady(true)
    }
  }
  const getServerFileListData = async () => {
    if (!curHost) return
    const connection = await connectLibrary(curHost)
    const capabilities = await connection.client.capabilities()
    if (capabilities.writable) await connection.client.scan(connection.libraryId)
    setFileServerFiles(sortServerFiles(await libraryPresentation(curHost.id, !!aggregationMode)))
  }
  useEffect(() => {
    if (!curHost || !isFileServerReady) return
    const current = ++generation.current
    let busy = false
    const refresh = async () => {
      if (busy) return
      busy = true
      try {
        if (curHost.type === FileServerType.StaticFileServer && window.electron && !curHost.token) {
          const response = await window.electron.createStaticFileServer({
            directoryPath: curHost.directoryPath,
            port: curHost.port,
            preferredInterface: curHost.preferredInterface,
          })
          if (!response?.url || response.errorMessage) throw new Error(response?.errorMessage || '启动资源库失败')
          if (current === generation.current)
            setFileServerHosts((hosts) =>
              hosts.map((host) =>
                host.id === curHost.id
                  ? { ...host, url: response.url, token: response.token, libraryId: response.libraryId }
                  : host,
              ),
            )
          return
        }
        await connectLibrary(curHost)
        const files = await libraryPresentation(curHost.id, !!aggregationMode)
        if (current === generation.current) setFileServerFiles(sortServerFiles(files))
      } catch (error) {
        if (current === generation.current)
          Notification.error({ title: '资源库同步失败', content: (error as Error).message })
      } finally {
        busy = false
        if (current === generation.current) setLoading(false)
      }
    }
    setLoading(true)
    void refresh()
    const timer = window.setInterval(refresh, 3000)
    return () => {
      generation.current++
      clearInterval(timer)
    }
  }, [curHost, isFileServerReady, aggregationMode])
  return {
    webDavClient,
    activate,
    pending,
    fileServerHosts,
    setFileServerHosts,
    curFileServerHostId,
    setCurFileServerHostId,
    curHost,
    searchKeyWord,
    setSearchKeyWord,
    isFileServerReady,
    setIsFileServerReady,
    fileServerFiles,
    setFileServerFiles,
    loading,
    setLoading,
    pkgInfoDataLoading: fileServerFiles.some((file) => ['pending', 'parsing'].includes(file.parseState || '')),
    paths,
    setPaths,
    getServerFileListData,
  }
}
