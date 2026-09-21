import { Check, ChevronDown, Monitor, Plus } from 'react-feather'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Popover } from '@/design-system'
import { useContainer } from '@/store/container'
import { usePS4HostForm } from '@/hooks/useHostForms'
export function HostSwitcher() {
  const { open: openHostForm } = usePS4HostForm()
  const {
    ps4Installer: { ps4Hosts, curSelectPs4HostId, setCurSelectPs4HostId },
  } = useContainer()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const selected = ps4Hosts.find((host) => host.id === curSelectPs4HostId)
  const settings = () => {
    setOpen(false)
    navigate('/settings/hosts', { state: { backgroundLocation: location } })
  }
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      title="安装到"
      trigger={
        <Button className="host-trigger">
          <Monitor />
          <span>{selected?.alias || selected?.url || '选择主机'}</span>
          <ChevronDown />
        </Button>
      }
    >
      <div className="host-options">
        {ps4Hosts.map((host) => (
          <Button
            key={host.id}
            variant="text"
            className="host-option"
            onClick={() => {
              setCurSelectPs4HostId(host.id)
              setOpen(false)
            }}
          >
            <Monitor />
            <span>
              <strong>{host.alias || 'PS4'}</strong>
              <small>{host.url}</small>
            </span>
            {host.id === curSelectPs4HostId && <Check aria-label="当前主机" />}
          </Button>
        ))}
        {!ps4Hosts.length && <p className="muted">还没有添加 PS4 主机</p>}
        <Button
          variant="text"
          icon={<Plus />}
          onClick={() => {
            setOpen(false)
            openHostForm()
          }}
        >
          添加主机
        </Button>
        <Button variant="text" onClick={() => settings()}>
          管理所有主机 →
        </Button>
      </div>
    </Popover>
  )
}
