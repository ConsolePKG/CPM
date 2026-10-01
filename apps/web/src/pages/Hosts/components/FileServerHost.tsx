import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Edit2, Plus, Trash2 } from 'react-feather'
import { Button, ConfirmDialog, Empty, IconButton, Notification } from '@/design-system'
import { shareLibrary, listLibraryShares } from '@/library/runtime'
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
  const [shareLink, setShareLink] = useState('')
  const [shares, setShares] = useState<{ id: string; revoked: boolean }[]>([])
  const [shareHost, setShareHost] = useState<Host>()
  const manageShares = async (host: Host) => {
    try {
      const result = await listLibraryShares(host)
      setShareHost(host)
      setShares(result.shares)
    } catch (error) {
      Notification.error((error as Error).message)
    }
  }
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
        <p>资源库提供游戏文件，可连接本地文件夹、WebDAV 或资源库服务。</p>
        <Button type="primary" icon={<Plus />} disabled={pending} onClick={() => open()}>
          添加资源库
        </Button>
      </div>
      <div className="hosts-cards">
        {fileServerHosts.map((host) => (
          <ConfigCard
            key={host.id}
            title={host.alias || host.url || '本地文件夹'}
            subTitle={
              host.type === FileServerType.WebDAV
                ? window.electron?.createWebDAVLibrary
                  ? 'WebDAV · 主机直连'
                  : 'WebDAV'
                : host.type === FileServerType.BrowserFiles
                  ? '本地文件夹 · 浏览器'
                  : host.type === FileServerType.StaticFileServer && host.directoryPath
                    ? '本地文件夹'
                    : '资源库服务'
            }
            meta={host.type === FileServerType.WebDAV ? host.url : host.directoryPath || host.url}
            isActive={host.id === curFileServerHostId}
            onClick={() => void activate(host)}
            action={
              <>
                {(host.type === FileServerType.LibraryService || host.type === FileServerType.StaticFileServer) && (
                  <Button
                    variant="text"
                    onClick={() => {
                      void shareLibrary(host).then(
                        (share) => {
                          setShareLink(share.url)
                          void manageShares(host)
                        },
                        (error) => Notification.error(error.message),
                      )
                    }}
                  >
                    创建只读分享
                  </Button>
                )}
                {(host.type === FileServerType.LibraryService || host.type === FileServerType.StaticFileServer) && (
                  <Button
                    variant="text"
                    onClick={() => {
                      setShareLink('')
                      void manageShares(host)
                    }}
                  >
                    管理分享
                  </Button>
                )}
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
      {!fileServerHosts.length && <Empty description="添加资源库连接，为游戏库提供文件来源。" />}
      {shareLink && (
        <p>
          分享链接（持有者可浏览和下载）：
          <input aria-label="分享链接" readOnly value={shareLink} onFocus={(event) => event.currentTarget.select()} />
        </p>
      )}
      {shareHost &&
        shares
          .filter((share) => !share.revoked)
          .map((share) => (
            <p key={share.id}>
              {share.id}{' '}
              <Button
                variant="text"
                onClick={() => {
                  void listLibraryShares(shareHost)
                    .then(async ({ client }) => {
                      await client.revokeShare(share.id)
                      await manageShares(shareHost)
                    })
                    .catch((error) => Notification.error(error.message))
                }}
              >
                撤销分享
              </Button>
            </p>
          ))}
      <ConfirmDialog
        visible={Boolean(deleting)}
        title="删除资源库连接？"
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
