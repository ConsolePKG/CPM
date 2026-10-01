import { useEffect, useRef, useState } from 'react'
import { Alert, Button, ConfirmDialog, Disclosure, FormField, Input, SegmentedControl } from '@/design-system'
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
  onDetectedPlatform,
}: {
  host: string
  platform: 'ps4' | 'ps5'
  onBusyChange: (busy: boolean) => void
  onInstalled: (address: string) => void
  onDetectedPlatform: (platform: 'ps4' | 'ps5') => void
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
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    let active = true
    setPort(platform === 'ps5' ? '9021' : '9090')
    setBundle(undefined)
    setBundleError('')
    getCPIBundle(platform)
      .then((value) => {
        if (active) setBundle(value)
      })
      .catch((error) => {
        if (active) setBundleError(error.message)
      })
    return () => {
      active = false
    }
  }, [platform])
  useEffect(() => {
    const controller = new AbortController()
    setChecking(true)
    setStatus(undefined)
    const timer = setTimeout(() => {
      getCPIStatus(host, controller.signal)
        .then((value) => {
          if (!controller.signal.aborted) {
            setStatus(value)
            if (value.state === 'online' && value.platform) onDetectedPlatform(value.platform)
          }
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
  }, [host, refresh, onDetectedPlatform])
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
          `CPI ${online.version} 已上线。${platform === 'ps5' ? `PS5 ELF 已通过 ${port} 加载。` : '启动文件已更新并校验。'}`,
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
      <div className="cpi-heading">
        <div>
          <strong>CPI 安装服务</strong>
          <span className="cpi-connection" data-online={!checking && status?.state === 'online'} role="status">
            {checking
              ? '查询中…'
              : status?.state === 'online'
                ? '已连接'
                : status?.state === 'legacy'
                  ? '旧版服务'
                  : '未连接'}
          </span>
        </div>
        <Button variant="text" loading={checking} disabled={busy} onClick={() => setRefresh((value) => value + 1)}>
          刷新
        </Button>
      </div>
      {status?.state === 'online' ? (
        <>
          <dl className="cpi-overview">
            <div>
              <dt>主机</dt>
              <dd>
                {platform.toUpperCase()} <small>系统 {status.systemVersion || '未知'}</small>
              </dd>
            </div>
            <div>
              <dt>当前版本</dt>
              <dd>{status.version || '未知'}</dd>
            </div>
            <div>
              <dt>内置版本</dt>
              <dd>{bundle?.version || (bundleError ? '读取失败' : '读取中…')}</dd>
            </div>
          </dl>
          {platform === 'ps5' && (
            <div className="cpi-capabilities" aria-label="服务功能">
              <span data-available={status.appinstError === 0}>
                {status.appinstError === 0
                  ? '安装服务可用'
                  : status.appinstError === undefined
                    ? '安装服务待确认'
                    : '安装服务异常'}
              </span>
              <span data-available={status.iconUpload}>{status.iconUpload ? '支持安装封面' : '暂不支持安装封面'}</span>
              <span data-available={status.canPauseResume && status.canCancel}>
                {status.canPauseResume && status.canCancel ? '支持暂停与取消' : '任务控制待验证'}
              </span>
            </div>
          )}
        </>
      ) : (
        <p className="cpi-description">
          {checking
            ? '正在连接主机上的 CPI…'
            : '请确认主机已联网，并运行 CPI。首次加载或服务离线时，选择主机平台后加载内置 CPI。'}
        </p>
      )}
      {!checking && status?.state !== 'online' && (
        <div className="cpm-form-field">
          <span className="cpm-field-label">加载到</span>
          <fieldset className="cpi-platform" disabled={busy}>
            <SegmentedControl
              label="加载 CPI 的主机平台"
              value={platform}
              onChange={onDetectedPlatform}
              options={[
                { value: 'ps4', label: 'PS4' },
                { value: 'ps5', label: 'PS5' },
              ]}
            />
          </fieldset>
          <p className="cpm-field-hint source-mode-hint">连接成功后自动识别平台；此选项用于选择正确的 CPI 文件。</p>
        </div>
      )}
      {!checking && status?.state !== 'offline' && status?.message && (
        <p className="cpi-description" role="status">
          {status.message}
        </p>
      )}
      <Disclosure
        key={checking ? 'checking' : status?.state}
        title="加载与维护"
        className="cpi-maintenance"
        defaultOpen={!checking && status?.state !== 'online'}
      >
        <div className="cpi-maintenance-content">
          <p className="cpi-description">
            内置 CPI {bundle?.version || (bundleError ? '读取失败' : '读取中…')} · {platform.toUpperCase()}
          </p>
          {bundleError && <Alert>{bundleError}</Alert>}
          <FormField
            label={platform === 'ps5' ? 'ELF loader 端口' : 'GoldHEN Payload Server 端口'}
            hint="请先在主机上开启对应的加载服务。"
          >
            <Input
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={setPort}
              disabled={busy}
              placeholder={platform === 'ps5' ? '9021' : '9090'}
            />
          </FormField>
          <div className="cpi-manager-actions">
            <Button loading={busy} disabled={!bundle || checking} onClick={() => setConfirmation(true)}>
              {status?.state === 'online' ? '重新加载 CPI' : '加载 CPI'}
            </Button>
            {platform === 'ps5' && status?.state === 'online' && status.canShutdown && (
              <Button disabled={busy} onClick={() => setStopConfirmation(true)}>
                停止 CPI
              </Button>
            )}
            {bundle && (
              <a href={`./cpi/rpi-payload-${platform}.elf`} download={`rpi-payload-${platform}.elf`}>
                下载 ELF
              </a>
            )}
          </div>
        </div>
      </Disclosure>
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
            ? `将通过 ${new URL(host).hostname}:${port} 发送 PS5 CPI ${bundle?.version || ''}。请先开启 ELF loader，并等待安装任务完成。在线新版 CPI 会先退出。`
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
