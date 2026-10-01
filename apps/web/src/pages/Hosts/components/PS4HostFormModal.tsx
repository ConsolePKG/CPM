import { nanoid } from 'nanoid'
import { useEffect, useState } from 'react'
import { Button, Drawer, FormField, Input, Notification, Alert } from '@/design-system'
import { useContainer } from '@/store/container'
import { validateConsoleAddress } from '../validation'
import { PS4Discovery } from './PS4Discovery'
import { CPIManager } from './CPIManager'
import { getCPIStatus } from '@/service/cpi'
export type FormData = { id?: string; alias?: string; url: string; platform?: 'ps4' | 'ps5' }
type Props = { data?: FormData; visible: boolean; onOk: (data: FormData) => void; onCancel: () => void }
export function PS4HostFormModal({ data, visible, onOk, onCancel }: Props) {
  const {
    ps4Installer: { ps4Hosts },
  } = useContainer()
  const [alias, setAlias] = useState('')
  const [platform, setPlatform] = useState<'ps4' | 'ps5'>('ps4')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [testing, setTesting] = useState(false)
  const [reinstalling, setReinstalling] = useState(false)
  const normalizedHost = validateConsoleAddress(url).url
  useEffect(() => {
    if (visible) {
      setAlias(data?.alias || '')
      setPlatform(data?.platform || 'ps4')
      setUrl((data?.url || '').replace(/^https?:\/\//, ''))
      setError('')
    }
  }, [visible, data])
  const submit = async (test = false) => {
    if (reinstalling) return
    const result = validateConsoleAddress(url)
    if (result.error) {
      setError(result.error)
      return
    }
    const normalized = result.url!
    if (!test && ps4Hosts.some((host) => host.id !== data?.id && host.url === normalized)) {
      setError('此主机地址已存在')
      return
    }
    setError('')
    if (test) {
      setTesting(true)
      try {
        const status = await getCPIStatus(normalized)
        if (status.state === 'online') {
          setPlatform(status.platform || 'ps4')
          Notification.success(`CPI ${status.version} 在线 · 系统 ${status.systemVersion || '未知'}`)
        } else if (status.state === 'legacy') Notification.success('旧版安装服务在线，暂不支持版本查询')
        else Notification.error(status.message || 'CPI 未连接')
      } catch {
        Notification.error('连接失败，请检查主机地址及 CPI 是否运行。')
      } finally {
        setTesting(false)
      }
    } else {
      const status = await getCPIStatus(normalized)
      onOk({
        id: data?.id || nanoid(),
        alias: alias.trim(),
        url: normalized,
        platform: status.state === 'online' ? status.platform : platform,
      })
      onCancel()
    }
  }
  return (
    <Drawer
      visible={visible}
      title={data?.id ? '编辑主机' : '添加主机'}
      onCancel={() => {
        if (!reinstalling) onCancel()
      }}
      footer={
        <>
          <Button disabled={reinstalling} onClick={onCancel}>
            取消
          </Button>
          <Button disabled={reinstalling} loading={testing} onClick={() => submit(true)}>
            连接测试
          </Button>
          <Button disabled={reinstalling} type="primary" onClick={() => submit()}>
            确认
          </Button>
        </>
      }
    >
      <form
        className="cpm-form"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        {visible && !data?.id && window.electron?.discoverPS4Hosts && (
          <PS4Discovery
            onSelect={(name, address) => {
              setAlias(name)
              setUrl(address)
              setError('')
            }}
          />
        )}
        <FormField label="别名">
          <Input disabled={reinstalling} value={alias} onChange={setAlias} placeholder="PlayStation · 客厅" />
        </FormField>
        <FormField label="主机地址" error={error} hint="请填写主机 IP 与 CPI 端口，常用端口为 12801。">
          <Input
            disabled={reinstalling}
            value={url}
            onChange={setUrl}
            prefix="http://"
            placeholder={platform === 'ps5' ? '192.168.1.125:12801' : '192.168.1.108:12801'}
            autoFocus
            required
          />
        </FormField>
        {visible && normalizedHost && (
          <CPIManager
            host={normalizedHost}
            platform={platform}
            onDetectedPlatform={setPlatform}
            onBusyChange={setReinstalling}
            onInstalled={setUrl}
          />
        )}
        {!normalizedHost && (
          <Alert>PS4 / PS5 需要运行 CPI 安装服务。填写地址后会自动识别主机；首次加载 CPI 时可手动选择平台。</Alert>
        )}
      </form>
    </Drawer>
  )
}
