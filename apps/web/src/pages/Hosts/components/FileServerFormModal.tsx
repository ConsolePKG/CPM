import { nanoid } from 'nanoid'
import { useEffect, useState } from 'react'
import { Button, Drawer, FormField, Input, Select, Switch, SegmentedControl, Notification } from '@/design-system'
import { useContainer } from '@/store/container'
import { FileServerType } from '@/types'
import { validateServerUrl } from '../validation'
export type FormData = {
  id?: string
  alias?: string
  type: FileServerType
  url: string
  username?: string
  password?: string
  directoryPath?: string
  port?: number
  iface?: string
  recursiveQuery?: boolean
}
type Props = { data?: FormData; visible: boolean; onOk: (data: FormData) => void; onCancel: () => void }
const defaults = (): FormData => ({
  type: window.electron ? FileServerType.StaticFileServer : FileServerType.WebDAV,
  url: '',
  port: 1090,
  recursiveQuery: Boolean(window.electron),
})
export function FileServerFormModal({ data, visible, onOk, onCancel }: Props) {
  const {
    fileServer: { fileServerHosts },
  } = useContainer()
  const [value, setValue] = useState<FormData>(defaults)
  const [ifaces, setIfaces] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const patch = (next: Partial<FormData>) => setValue((old) => ({ ...old, ...next }))
  useEffect(() => {
    if (visible) {
      setValue(data ? { ...data } : defaults())
      setErrors({})
    }
  }, [visible, data])
  useEffect(() => {
    if (!visible || !window.electron) return
    let active = true
    setLoading(true)
    window.electron
      .getAvailableInterfaces()
      .then((items) => {
        if (active) {
          const addresses = Array.isArray(items) ? items.map((item) => item.ipv4) : []
          if (!Array.isArray(items)) Notification.error(items.errorMessage || '读取网络接口失败')
          setIfaces(addresses)
          setValue((old) => ({ ...old, iface: old.iface || addresses[0] }))
        }
      })
      .catch(() => {
        if (active) Notification.error('读取网络接口失败')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [visible])
  const local = value.type === FileServerType.StaticFileServer && Boolean(window.electron)
  const submit = () => {
    const next = {
      ...value,
      id: value.id || nanoid(),
      alias: value.alias?.trim(),
      url: value.url.trim().replace(/\/$/, ''),
    }
    const issues: Record<string, string> = {}
    if (local) {
      if (!next.directoryPath) issues.directoryPath = '请选择游戏文件夹'
      if (!Number.isInteger(next.port) || next.port! < 1024 || next.port! > 65535)
        issues.port = '端口须为 1024–65535 之间的整数'
      if (
        fileServerHosts.some(
          (host) =>
            host.id !== next.id &&
            host.type === FileServerType.StaticFileServer &&
            host.directoryPath === next.directoryPath,
        )
      )
        issues.directoryPath = '此文件夹已添加'
    } else {
      const error = validateServerUrl(next.url)
      if (error) issues.url = error
      if (fileServerHosts.some((host) => host.id !== next.id && host.url === next.url))
        issues.url = '此服务器地址已存在'
      if (next.type === FileServerType.StaticFileServer && !error) {
        const url = new URL(next.url)
        next.port = Number(url.port || (url.protocol === 'https:' ? 443 : 80))
      }
    }
    setErrors(issues)
    if (Object.keys(issues).length) return
    onOk(next)
    onCancel()
  }
  return (
    <Drawer visible={visible} title={data?.id ? '编辑文件服务器' : '添加文件服务器'} onCancel={onCancel} onOk={submit}>
      <form
        className="cpm-form"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        {!data?.id && (
          <SegmentedControl
            label="服务器类型"
            value={value.type}
            onChange={(type) => patch({ type, recursiveQuery: type === FileServerType.StaticFileServer })}
            options={[
              { value: FileServerType.StaticFileServer, label: '静态文件服务器' },
              { value: FileServerType.WebDAV, label: 'WebDAV' },
            ]}
          />
        )}
        <FormField label="别名">
          <Input value={value.alias || ''} onChange={(alias) => patch({ alias })} placeholder="NAS / PS4" />
        </FormField>
        {!local && (
          <FormField label="服务器地址" error={errors.url} hint="包含协议，例如 https://nas.example.com:5006">
            <Input autoFocus value={value.url} onChange={(url) => patch({ url })} placeholder="https://" required />
          </FormField>
        )}
        {local ? (
          <>
            <FormField label="网络接口" hint="选择 PS4 可访问的局域网接口。">
              <Select
                label="网络接口"
                value={value.iface || ''}
                onChange={(iface) => patch({ iface })}
                disabled={loading}
                options={[
                  { value: '', label: loading ? '加载中…' : '自动' },
                  ...ifaces.map((iface) => ({ value: iface, label: iface })),
                ]}
              />
            </FormField>
            <FormField label="文件夹" error={errors.directoryPath}>
              <Button
                onClick={async () => {
                  const path = await window.electron?.openDirectoryDialog()
                  if (path) patch({ directoryPath: path })
                }}
              >
                选择文件夹
              </Button>
              {value.directoryPath && <p className="host-path">{value.directoryPath}</p>}
            </FormField>
            <FormField label="端口" error={errors.port}>
              <Input
                type="number"
                min={1024}
                max={65535}
                value={value.port ?? 1090}
                onChange={(port) => patch({ port: Number(port) })}
              />
            </FormField>
          </>
        ) : (
          value.type === FileServerType.WebDAV && (
            <>
              <FormField label="用户名">
                <Input
                  autoComplete="username"
                  value={value.username || ''}
                  onChange={(username) => patch({ username })}
                />
              </FormField>
              <FormField label="密码">
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={value.password || ''}
                  onChange={(password) => patch({ password })}
                />
              </FormField>
            </>
          )
        )}
        <FormField
          label="递归查询"
          hint={
            value.type === FileServerType.WebDAV
              ? 'WebDAV 服务器需开启 DavDepthInfinity，才可递归查询。'
              : '同时读取子文件夹中的 PKG 文件。'
          }
        >
          <Switch
            label="递归查询"
            checked={Boolean(value.recursiveQuery)}
            onChange={(recursiveQuery) => patch({ recursiveQuery })}
          />
        </FormField>
      </form>
    </Drawer>
  )
}
