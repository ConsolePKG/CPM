import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Edit2, Plus, Trash2 } from 'react-feather'
import { Button, ConfirmDialog, Empty, IconButton, Notification } from '@/design-system'
import { ConfigCard } from '@/components/ConfigCard'
import { useContainer } from '@/store/container'
import { FileServerType, type FileServerHost as Host } from '@/types'
import { FileServerFormModal, type FormData } from './FileServerFormModal'
import '../hosts.less'
export function FileServerHost() {
  const [params] = useSearchParams()
  const [visible, setVisible] = useState(params.get('add') === 'true' || params.get('openFileServerHost') === 'true')
  const [editing, setEditing] = useState<FormData>()
  const [deleting, setDeleting] = useState<Host>()
  const [pending, setPending] = useState(false)
  const {
    fileServer: {
      fileServerHosts,
      setFileServerHosts,
      curFileServerHostId,
      setCurFileServerHostId,
      setFileServerFiles,
      setPaths,
      setIsFileServerReady,
    },
  } = useContainer()
  const activate = async (host: Host) => {
    if (pending) return
    setPending(true)
    setIsFileServerReady(false)
    try {
      let selected = host
      if (host.type === FileServerType.StaticFileServer && window.electron) {
        const response = await window.electron.createStaticFileServer({
          directoryPath: host.directoryPath,
          port: host.port,
          preferredInterface: host.preferredInterface,
        })
        if (!response?.url) throw new Error(response?.errorMessage || '启动文件服务器失败')
        selected = { ...host, url: response.url }
        setFileServerHosts((old) => old.map((item) => (item.id === host.id ? selected : item)))
        Notification.success({ title: '文件服务器已启动', content: response.url })
      }
      setPaths([])
      setFileServerFiles([])
      setCurFileServerHostId(selected.id)
    } catch (err) {
      Notification.error({ title: '切换文件服务器失败', content: (err as Error).message })
    } finally {
      setIsFileServerReady(true)
      setPending(false)
    }
  }
  const save = (value: FormData) => {
    const common = { id: value.id!, alias: value.alias, url: value.url, recursiveQuery: value.recursiveQuery }
    const host: Host =
      value.type === FileServerType.WebDAV
        ? { ...common, type: value.type, options: { username: value.username, password: value.password } }
        : {
            ...common,
            type: value.type,
            directoryPath: value.directoryPath || '',
            port: value.port || 1090,
            preferredInterface: value.iface,
          }
    const exists = fileServerHosts.some((item) => item.id === host.id)
    setFileServerHosts((old) => (exists ? old.map((item) => (item.id === host.id ? host : item)) : [...old, host]))
    if (!exists || host.id === curFileServerHostId) void activate(host)
  }
  return (
    <section className="hosts-section">
      <div className="hosts-heading">
        <p>WebDAV 或静态文件服务器中的游戏资源。</p>
        <Button
          type="primary"
          icon={<Plus />}
          disabled={pending}
          onClick={() => {
            setEditing(undefined)
            setVisible(true)
          }}
        >
          添加服务器
        </Button>
      </div>
      <div className="hosts-cards">
        {fileServerHosts.map((host) => (
          <ConfigCard
            key={host.id}
            title={host.alias || host.url || '本地文件夹'}
            subTitle={host.type === FileServerType.WebDAV ? 'WebDAV' : '静态文件服务器'}
            meta={host.type === FileServerType.WebDAV ? host.url : host.directoryPath || host.url}
            isActive={host.id === curFileServerHostId}
            onClick={() => void activate(host)}
            action={
              <>
                <IconButton
                  label={`编辑 ${host.alias || host.url}`}
                  variant="text"
                  disabled={pending}
                  onClick={() => {
                    setEditing(
                      host.type === FileServerType.WebDAV
                        ? { ...host, username: host.options?.username, password: host.options?.password }
                        : { ...host, iface: host.preferredInterface },
                    )
                    setVisible(true)
                  }}
                >
                  <Edit2 />
                </IconButton>
                <IconButton
                  label={`删除 ${host.alias || host.url}`}
                  variant="text"
                  disabled={pending}
                  onClick={() => setDeleting(host)}
                >
                  <Trash2 />
                </IconButton>
              </>
            }
          />
        ))}
      </div>
      {!fileServerHosts.length && <Empty description="添加文件服务器，开始浏览游戏库。" />}
      <FileServerFormModal visible={visible} data={editing} onOk={save} onCancel={() => setVisible(false)} />
      <ConfirmDialog
        visible={Boolean(deleting)}
        title="删除文件服务器配置？"
        description="只移除保存的连接配置，不会删除服务器上的文件。"
        onCancel={() => setDeleting(undefined)}
        onConfirm={() => {
          setFileServerHosts((old) => old.filter((host) => host.id !== deleting?.id))
          if (deleting?.id === curFileServerHostId) {
            setCurFileServerHostId(undefined)
            setFileServerFiles([])
            setPaths([])
          }
          setDeleting(undefined)
        }}
      />
    </section>
  )
}
