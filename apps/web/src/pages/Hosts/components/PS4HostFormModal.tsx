import axios from 'axios'
import { nanoid } from 'nanoid'
import { useEffect, useState } from 'react'
import { Button, Drawer, FormField, Input, Notification, Alert } from '@/design-system'
import { RPILink } from '@/components/WebAlert'
import { useContainer } from '@/store/container'
import { validateConsoleAddress } from '../validation'
export type FormData = { id?: string; alias?: string; url: string }
type Props = { data?: FormData; visible: boolean; onOk: (data: FormData) => void; onCancel: () => void }
export function PS4HostFormModal({ data, visible, onOk, onCancel }: Props) {
  const {
    ps4Installer: { ps4Hosts },
  } = useContainer()
  const [alias, setAlias] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [testing, setTesting] = useState(false)
  useEffect(() => {
    if (visible) {
      setAlias(data?.alias || '')
      setUrl((data?.url || '').replace(/^https?:\/\//, ''))
      setError('')
    }
  }, [visible, data])
  const submit = async (test = false) => {
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
        await axios.get(normalized + '/api', { timeout: 3000 })
        Notification.error('连接失败，请检查主机地址和 RPI 是否运行。')
      } catch (err) {
        if (axios.isAxiosError(err) && (err.response?.status === 400 || err.response?.data?.status === 'fail'))
          Notification.success('已连接到 PS4 主机')
        else Notification.error('连接失败，请检查 IP、端口及 Remote Package Installer。')
      } finally {
        setTesting(false)
      }
    } else {
      onOk({ id: data?.id || nanoid(), alias: alias.trim(), url: normalized })
      onCancel()
    }
  }
  return (
    <Drawer
      visible={visible}
      title={data?.id ? '编辑 PS4 主机' : '添加 PS4 主机'}
      onCancel={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>取消</Button>
          <Button loading={testing} onClick={() => submit(true)}>
            连接测试
          </Button>
          <Button type="primary" onClick={() => submit()}>
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
        <FormField label="别名">
          <Input value={alias} onChange={setAlias} placeholder="PS4 · 客厅" />
        </FormField>
        <FormField label="主机地址" error={error} hint="请填写 IP 与端口，常用端口为 12800 或 12801。">
          <Input value={url} onChange={setUrl} prefix="http://" placeholder="192.168.1.108:12801" autoFocus required />
        </FormField>
        {!data?.id && (
          <Alert>
            主机上需要运行 Remote Package Installer。建议使用支持中文和空格路径的 <RPILink />。
          </Alert>
        )}
      </form>
    </Drawer>
  )
}
