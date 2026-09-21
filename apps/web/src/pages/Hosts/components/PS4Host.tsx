import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Edit2, Plus, Trash2 } from 'react-feather'
import { Button, ConfirmDialog, Empty, IconButton } from '@/design-system'
import { ConfigCard } from '@/components/ConfigCard'
import { useContainer } from '@/store/container'
import type { PS4Host as Host } from '@/types'
import { usePS4HostForm } from '@/hooks/useHostForms'
import '../hosts.less'
export function PS4Host() {
  const [params] = useSearchParams()
  const { open } = usePS4HostForm()
  useEffect(() => {
    if (params.get('add') === 'true' || params.get('openPs4Host') === 'true') open()
  }, [params, open])
  const [deleting, setDeleting] = useState<Host>()
  const {
    ps4Installer: { ps4Hosts, setPs4Hosts, curSelectPs4HostId, setCurSelectPs4HostId },
  } = useContainer()
  return (
    <section className="hosts-section">
      <div className="hosts-heading">
        <p>管理 Remote Package Installer 安装目标。</p>
        <Button icon={<Plus />} type="primary" onClick={() => open()}>
          添加主机
        </Button>
      </div>
      <div className="hosts-cards">
        {ps4Hosts.map((host) => (
          <ConfigCard
            key={host.id}
            title={host.alias || host.url}
            meta={host.url}
            isActive={host.id === curSelectPs4HostId}
            onClick={() => setCurSelectPs4HostId(host.id)}
            action={
              <>
                <IconButton label={`编辑 ${host.alias || host.url}`} variant="text" onClick={() => open(host)}>
                  <Edit2 />
                </IconButton>
                <IconButton label={`删除 ${host.alias || host.url}`} variant="text" onClick={() => setDeleting(host)}>
                  <Trash2 />
                </IconButton>
              </>
            }
          />
        ))}
      </div>
      {!ps4Hosts.length && <Empty description="添加 PS4 主机后，即可发送安装任务。" />}
      <ConfirmDialog
        visible={Boolean(deleting)}
        title="删除主机配置？"
        description="仅移除 CPM 中保存的连接配置，不会修改主机上的内容。"
        onCancel={() => setDeleting(undefined)}
        onConfirm={() => {
          setPs4Hosts((old) => old.filter((host) => host.id !== deleting?.id))
          if (deleting?.id === curSelectPs4HostId) setCurSelectPs4HostId(undefined)
          setDeleting(undefined)
        }}
      />
    </section>
  )
}
