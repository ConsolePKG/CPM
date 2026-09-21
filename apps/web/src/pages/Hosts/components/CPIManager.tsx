import { useEffect, useRef, useState } from 'react'
import { Alert, Button, ConfirmDialog, FormField, Input } from '@/design-system'
import { getCPIBundle, getCPIStatus, reinstallCPI, type CPIBundle, type CPIStatus } from '@/service/cpi'

export function CPIManager({
  host,
  onBusyChange,
  onInstalled,
}: {
  host: string
  onBusyChange: (busy: boolean) => void
  onInstalled: (address: string) => void
}) {
  const [status, setStatus] = useState<CPIStatus>()
  const [bundle, setBundle] = useState<CPIBundle>()
  const [refresh, setRefresh] = useState(0)
  const [checking, setChecking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmation, setConfirmation] = useState(false)
  const [port, setPort] = useState('9090')
  const [message, setMessage] = useState('')
  const [bundleError, setBundleError] = useState('')
  const running = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    getCPIBundle()
      .then((value) => {
        if (mounted.current) setBundle(value)
      })
      .catch((error) => {
        if (mounted.current) setBundleError(error.message)
      })
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setChecking(true)
    setStatus(undefined)
    const timer = setTimeout(() => {
      getCPIStatus(host, controller.signal)
        .then((value) => {
          if (!controller.signal.aborted) setStatus(value)
        })
        .catch(() => {})
        .finally(() => {
          if (!controller.signal.aborted) setChecking(false)
        })
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [host, refresh])
  const reinstall = async () => {
    if (running.current) return
    running.current = true
    setConfirmation(false)
    setBusy(true)
    onBusyChange(true)
    try {
      const online = await reinstallCPI(host, Number(port), (value) => {
        if (mounted.current) setMessage(value)
      })
      if (mounted.current) {
        setStatus(online)
        setMessage(`CPI ${online.version} 已上线。运行服务已重新加载，/data/payloads 启动文件已更新并校验。`)
        const installed = new URL(host)
        installed.port = '12801'
        onInstalled(installed.host)
      }
    } catch (error) {
      if (mounted.current) setMessage((error as Error).message)
    } finally {
      running.current = false
      if (mounted.current) setBusy(false)
      onBusyChange(false)
    }
  }
  return (
    <section className="cpi-manager" aria-label="CPI 服务">
      <div className="ps4-discovery-heading">
        <strong>CPI 服务</strong>
        <Button variant="text" loading={checking} disabled={busy} onClick={() => setRefresh((value) => value + 1)}>
          刷新状态
        </Button>
      </div>
      <dl className="cpi-status-grid" aria-live="polite">
        <dt>服务状态</dt>
        <dd>
          {checking
            ? '查询中…'
            : status?.state === 'online'
              ? 'CPI 在线'
              : status?.state === 'legacy'
                ? '旧版安装服务在线'
                : '未连接'}
        </dd>
        <dt>PS4 系统版本</dt>
        <dd>{status?.systemVersion || '未知'}</dd>
        <dt>CPI 软件版本</dt>
        <dd>{status?.version || '未知'}</dd>
        <dt>内置 CPI 版本</dt>
        <dd>{bundle ? `${bundle.version} · ${bundle.sha256.slice(0, 12)}` : bundleError || '读取中…'}</dd>
      </dl>
      {status?.message && <p>{status.message}</p>}
      <FormField label="GoldHEN Payload Server 端口">
        <Input value={port} onChange={setPort} disabled={busy} placeholder="9090" />
      </FormField>
      <div className="cpi-manager-actions">
        <Button loading={busy} disabled={!bundle || checking} onClick={() => setConfirmation(true)}>
          重装 CPI
        </Button>
        {bundle && (
          <a href="./cpi/rpi-payload-ps4.elf" download="rpi-payload-ps4.elf">
            下载内置 ELF
          </a>
        )}
      </div>
      {message && (
        <Alert>
          <span role="status">{message}</span>
        </Alert>
      )}
      <ConfirmDialog
        visible={confirmation}
        title="重新加载内置 CPI？"
        description={`将向 ${new URL(host).hostname}:${port} 发送 CPI ${bundle?.version || ''}。请先开启 GoldHEN Payload Server，并等待安装任务完成。在线 CPI 会先退出；若显示未连接，请先确认旧 CPI 已停止。此操作也会更新 /data/payloads 中的 CPI 启动文件。`}
        confirmText="重装 CPI"
        onCancel={() => setConfirmation(false)}
        onConfirm={() => void reinstall()}
      />
    </section>
  )
}
