import { useMemo } from 'react'
import { useContainer } from '@/store/container'
import { usePS4HostForm, useFileServerForm } from '@/hooks/useHostForms'
import { FileServerType, type FileServerHost, type PS4Host } from '@/types'
import { PS4HostFormModal, type FormData as PS4FormData } from '@/pages/Hosts/components/PS4HostFormModal'
import { FileServerFormModal, type FormData as FileServerFormData } from '@/pages/Hosts/components/FileServerFormModal'

// Render inside the active page's dialog tree so Base UI preserves nested focus/Escape handling.
export function HostFormDialogs() {
  const ps4 = usePS4HostForm()
  const server = useFileServerForm()
  const {
    ps4Installer: { setPs4Hosts, setCurSelectPs4HostId },
    fileServer: { fileServerHosts, setFileServerHosts, curFileServerHostId, activate },
  } = useContainer()
  const serverData = useMemo(() => {
    const host = server.host
    if (!host) return undefined
    return host.type === FileServerType.WebDAV
      ? { ...host, username: host.options?.username, password: host.options?.password }
      : { ...host, iface: host.preferredInterface }
  }, [server.host])
  const savePS4 = (value: PS4FormData) => {
    const host: PS4Host = { ...value, id: value.id! }
    setPs4Hosts((old) =>
      old.some((item) => item.id === host.id) ? old.map((item) => (item.id === host.id ? host : item)) : [...old, host],
    )
    setCurSelectPs4HostId(host.id)
  }
  const saveServer = (value: FileServerFormData) => {
    const common = { id: value.id!, alias: value.alias, url: value.url, recursiveQuery: value.recursiveQuery }
    const host: FileServerHost =
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
    <>
      <PS4HostFormModal visible={ps4.visible} data={ps4.host} onOk={savePS4} onCancel={ps4.close} />
      <FileServerFormModal visible={server.visible} data={serverData} onOk={saveServer} onCancel={server.close} />
    </>
  )
}
