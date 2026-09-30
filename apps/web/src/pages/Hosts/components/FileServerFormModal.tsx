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
  token?: string
  createService?: boolean
  sourceType?: 'folder' | 'webdav'
  sourceRoot?: string
  sourceUrl?: string
  libraryId?: string
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
    } else if (next.type !== FileServerType.BrowserFiles) {
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
    if (next.createService && next.type === FileServerType.LibraryService) {
      if (!next.token) issues.token = '创建资源库需要管理员令牌'
      if ((next.sourceType || 'folder') === 'folder' && !next.sourceRoot)
        issues.sourceRoot = '请输入服务端已挂载的文件夹路径'
      if (next.sourceType === 'webdav' && validateServerUrl(next.sourceUrl || ''))
        issues.sourceUrl = '请输入 WebDAV 地址'
    }
    if (Object.keys(issues).length) return
    onOk(next)
    onCancel()
  }
  return (
    <Drawer visible={visible} title={data?.id ? '编辑资源库' : '添加资源库'} onCancel={onCancel} onOk={submit}>
      <form
        className="cpm-form"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        {!data?.id && (
          <SegmentedControl
            label="操作"
            value={value.type === FileServerType.LibraryService && !value.createService ? 'connect' : 'create'}
            onChange={(mode) =>
              patch(
                mode === 'connect'
                  ? { type: FileServerType.LibraryService, createService: false }
                  : {
                      type: window.electron ? FileServerType.StaticFileServer : FileServerType.WebDAV,
                      createService: false,
                    },
              )
            }
            options={[
              { value: 'create', label: '创建自己的资源库' },
              { value: 'connect', label: '连接已有资源库' },
            ]}
          />
        )}
        {!data?.id && (value.type !== FileServerType.LibraryService || value.createService) && (
          <SegmentedControl
            label="运行位置与来源"
            value={value.createService ? 'node' : value.type}
            onChange={(type) =>
              patch(
                type === 'node'
                  ? {
                      type: FileServerType.LibraryService,
                      createService: true,
                      sourceType: 'folder',
                      sourceRoot: '/games',
                    }
                  : { type: type as FileServerType, createService: false, recursiveQuery: true },
              )
            }
            options={[
              { value: 'node', label: 'NAS / Node 服务' },
              ...(window.electron
                ? [{ value: FileServerType.StaticFileServer, label: '创建文件夹库' }]
                : [{ value: FileServerType.BrowserFiles, label: '浏览器文件夹库' }]),
              { value: FileServerType.WebDAV, label: '创建 WebDAV 库' },
            ]}
          />
        )}
        <FormField label="别名">
          <Input value={value.alias || ''} onChange={(alias) => patch({ alias })} placeholder="NAS / PS4" />
        </FormField>
        {!local && value.type !== FileServerType.BrowserFiles && (
          <FormField label="服务器地址" error={errors.url} hint="包含协议，例如 https://nas.example.com:5006">
            <Input autoFocus value={value.url} onChange={(url) => patch({ url })} placeholder="https://" required />
          </FormField>
        )}
        {value.type === FileServerType.LibraryService && (
          <FormField
            label="访问令牌"
            error={errors.token}
            hint="管理员令牌或只读分享令牌；也可直接粘贴包含 #token 的分享链接。"
          >
            <Input type="password" value={value.token || ''} onChange={(token) => patch({ token })} />
          </FormField>
        )}
        {value.type === FileServerType.LibraryService && !value.createService && (
          <FormField label="资源库 ID（可选）" hint="留空连接服务中的第一个可访问资源库。">
            <Input value={value.libraryId || ''} onChange={(libraryId) => patch({ libraryId })} />
          </FormField>
        )}
        {value.type === FileServerType.LibraryService && value.createService && (
          <>
            <Select
              label="来源"
              value={value.sourceType || 'folder'}
              onChange={(sourceType) => patch({ sourceType: sourceType as 'folder' | 'webdav' })}
              options={[
                { value: 'folder', label: '服务端文件夹' },
                { value: 'webdav', label: 'WebDAV' },
              ]}
            />
            {value.sourceType === 'webdav' ? (
              <>
                <FormField label="WebDAV 地址" error={errors.sourceUrl}>
                  <Input value={value.sourceUrl || ''} onChange={(sourceUrl) => patch({ sourceUrl })} />
                </FormField>
                <FormField label="用户名">
                  <Input value={value.username || ''} onChange={(username) => patch({ username })} />
                </FormField>
                <FormField label="密码">
                  <Input type="password" value={value.password || ''} onChange={(password) => patch({ password })} />
                </FormField>
              </>
            ) : (
              <FormField
                label="服务端文件夹"
                error={errors.sourceRoot}
                hint="Docker 默认只读挂载 /games；这不是当前浏览器的文件路径。"
              >
                <Input value={value.sourceRoot || ''} onChange={(sourceRoot) => patch({ sourceRoot })} />
              </FormField>
            )}
          </>
        )}
        {value.type === FileServerType.BrowserFiles && (
          <p>授权选择文件夹后本地解析。重新打开页面需要再次授权；发送安装需桌面/NAS 托管。</p>
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
        <FormField label="递归查询" hint="资源库统一递归索引来源；WebDAV 使用逐目录枚举，不要求 Depth Infinity。">
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
