import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Edit2, Plus, Trash2 } from 'react-feather'
import { Button, ConfirmDialog, Empty, IconButton } from '@/design-system'
import { ConfigCard } from '@/components/ConfigCard'
import { useContainer } from '@/store/container'
import { FileServerType, type FileServerHost as Host } from '@/types'
import { useFileServerForm } from '@/hooks/useHostForms'
import '../hosts.less'
export function FileServerHost() {
  const [params] = useSearchParams()
  const { open } = useFileServerForm()
  useEffect(() => {
    if (params.get('add') === 'true' || params.get('openFileServerHost') === 'true') open()
  }, [params, open])
  const [deleting, setDeleting] = useState<Host>()
  const {
    fileServer: {
      fileServerHosts,
      setFileServerHosts,
      curFileServerHostId,
      setCurFileServerHostId,
      setFileServerFiles,
      setPaths,
      activate,
      pending,
    },
  } = useContainer()
  return (
    <section className="hosts-section">
      <div className="hosts-heading">
        <p>WebDAV 或静态文件服务器中的游戏资源。</p>
        <Button type="primary" icon={<Plus />} disabled={pending} onClick={() => open()}>
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
                  onClick={() => open(host)}
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
