import { useEffect, useRef, useState } from 'react'
import { Alert, Button, ConfirmDialog, FormField, Input } from '@/design-system'
import {
  getCPIBundle,
  getCPIStatus,
  reinstallCPI,
  reinstallPS5CPI,
  stopPS5CPI,
  type CPIBundle,
  type CPIStatus,
} from '@/service/cpi'

export function CPIManager({
  host,
  platform,
  onBusyChange,
  onInstalled,
}: {
  host: string
  platform: 'ps4' | 'ps5'
  onBusyChange: (busy: boolean) => void
  onInstalled: (address: string) => void
}) {
  const [status, setStatus] = useState<CPIStatus>()
  const [bundle, setBundle] = useState<CPIBundle>()
  const [refresh, setRefresh] = useState(0)
  const [checking, setChecking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmation, setConfirmation] = useState(false)
  const [stopConfirmation, setStopConfirmation] = useState(false)
  const [port, setPort] = useState(platform === 'ps5' ? '9021' : '9090')
  const [message, setMessage] = useState('')
  const [bundleError, setBundleError] = useState('')
  const running = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    getCPIBundle(platform)
      .then((value) => {
        if (mounted.current) setBundle(value)
      })
      .catch((error) => {
        if (mounted.current) setBundleError(error.message)
      })
    return () => {
      mounted.current = false
    }
  }, [platform])
  useEffect(() => {
    setPort(platform === 'ps5' ? '9021' : '9090')
    setBundle(undefined)
    setBundleError('')
  }, [platform])
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
      const online = await (platform === 'ps5' ? reinstallPS5CPI : reinstallCPI)(host, Number(port), (value) => {
        if (mounted.current) setMessage(value)
      })
      if (mounted.current) {
        setStatus(online)
        setMessage(
          `CPI ${online.version} 已上线。${platform === 'ps5' ? 'PS5 ELF 已通过 9021 加载。' : '启动文件已更新并校验。'}`,
        )
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
  const stop = async () => {
    if (running.current) return
    running.current = true
    setStopConfirmation(false)
    setBusy(true)
    onBusyChange(true)
    try {
      await stopPS5CPI(host)
      if (mounted.current) {
        setStatus({ state: 'offline' })
        setMessage('PS5 CPI 已停止，端口已释放。')
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
        <dt>{platform.toUpperCase()} 系统版本</dt>
        <dd>{status?.systemVersion || '未知'}</dd>
        <dt>CPI 软件版本</dt>
        <dd>{status?.version || '未知'}</dd>
        {platform === 'ps5' && (
          <>
            <dt>AppInst 状态</dt>
            <dd>
              {status?.appinstError === undefined
                ? '未知'
                : status.appinstError === 0
                  ? '可用'
                  : `错误 0x${(status.appinstError >>> 0).toString(16)}`}
            </dd>
          </>
        )}
        {platform === 'ps5' && (
          <>
            <dt>PS5 安装封面</dt>
            <dd>{status?.iconUpload ? '支持上传' : '当前 ELF 未提供'}</dd>
            <dt>任务控制</dt>
            <dd>
              {status?.canPauseResume && status?.canCancel
                ? '支持暂停、恢复、取消'
                : '可查询进度；暂停、恢复、取消待验证'}
            </dd>
          </>
        )}
        <dt>内置 CPI 版本</dt>
        <dd>{bundle ? `${bundle.version} · ${bundle.sha256.slice(0, 12)}` : bundleError || '读取中…'}</dd>
      </dl>
      {status?.message && <p>{status.message}</p>}
      <FormField label={platform === 'ps5' ? 'etaHEN ELF loader 端口' : 'GoldHEN Payload Server 端口'}>
        <Input value={port} onChange={setPort} disabled={busy} placeholder={platform === 'ps5' ? '9021' : '9090'} />
      </FormField>
      <div className="cpi-manager-actions">
        <Button loading={busy} disabled={!bundle || checking} onClick={() => setConfirmation(true)}>
          {platform === 'ps5' ? '更新 PS5 CPI' : '重装 CPI'}
        </Button>
        {platform === 'ps5' && status?.state === 'online' && status.canShutdown && (
          <Button disabled={busy} onClick={() => setStopConfirmation(true)}>
            停止 CPI
          </Button>
        )}
        {bundle && (
          <a href={`./cpi/rpi-payload-${platform}.elf`} download={`rpi-payload-${platform}.elf`}>
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
        description={
          platform === 'ps5'
            ? `将通过 ${new URL(host).hostname}:${port} 发送 PS5 CPI ${bundle?.version || ''}。请等待安装任务完成。在线新版 CPI 会先退出。`
            : `将向 ${new URL(host).hostname}:${port} 发送 CPI ${bundle?.version || ''}。请先开启 GoldHEN Payload Server，并等待安装任务完成。在线 CPI 会先退出；若显示未连接，请先确认旧 CPI 已停止。此操作也会更新 /data/payloads 中的 CPI 启动文件。`
        }
        confirmText="重装 CPI"
        onCancel={() => setConfirmation(false)}
        onConfirm={() => void reinstall()}
      />
      <ConfirmDialog
        visible={stopConfirmation}
        title="停止 PS5 CPI？"
        description="请先等待当前安装任务完成。停止后需要通过 9021 重新发送 ELF，安装服务才会恢复。"
        confirmText="停止 CPI"
        onCancel={() => setStopConfirmation(false)}
        onConfirm={() => void stop()}
      />
    </section>
  )
}
