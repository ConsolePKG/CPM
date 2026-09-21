import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'react-feather'
import type { DiscoveredPS4 } from 'common/types'
import { Button } from '@/design-system'
import '../hosts.less'

export function PS4Discovery({ onSelect }: { onSelect: (name: string, address: string) => void }) {
  const [hosts, setHosts] = useState<DiscoveredPS4[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const request = useRef(0)
  const search = useCallback(async () => {
    const current = ++request.current
    setLoading(true)
    setError('')
    setHosts([])
    try {
      const result = await window.electron!.discoverPS4Hosts()
      if (current !== request.current) return
      setHosts(result.hosts)
      setError(result.errorMessage || '')
    } catch {
      if (current === request.current) setError('搜索失败，请检查网络连接后重试。')
    } finally {
      if (current === request.current) setLoading(false)
    }
  }, [])
  useEffect(() => {
    void search()
    return () => {
      request.current += 1
    }
  }, [search])
  return (
    <section className="ps4-discovery" aria-label="局域网主机" aria-busy={loading}>
      <div className="ps4-discovery-heading">
        <strong>局域网主机</strong>
        <Button variant="text" loading={loading} icon={<RefreshCw size={16} />} onClick={() => void search()}>
          {loading ? '搜索中…' : '重新搜索'}
        </Button>
      </div>
      <div role="status">
        {error && <p>{error}</p>}
        {!loading && !error && !hosts.length && (
          <p>
            未发现 PS4。请确认电脑与主机在同一局域网，并在 PS4 开启“设定 → 网络 → 与互联网连接”。也可以在下方手动填写。
          </p>
        )}
      </div>
      {hosts.map((host) => (
        <div className="ps4-discovery-host" key={host.address}>
          <div>
            <strong>{host.name}</strong>
            <p>
              {host.address} · {host.status === 'standby' ? '待机' : '已开机'}
              {host.services?.find((service) => service.systemVersion)?.systemVersion &&
                ` · 系统 ${host.services.find((service) => service.systemVersion)!.systemVersion}`}
            </p>
            {host.ports.length ? (
              host.ports.map((port) => {
                const service = host.services?.find((item) => item.port === port)
                return (
                  <p key={port}>
                    CPI 可用{service?.version ? ` · v${service.version}` : ' · 版本未知'}
                    {host.ports.length > 1 && ` · 端口 ${port}`}
                  </p>
                )
              })
            ) : (
              <p>未检测到 CPI，请启动 CPI 并确认端口。</p>
            )}
          </div>
          <div className="ps4-discovery-actions">
            {host.ports.length ? (
              host.ports.map((port) => (
                <Button key={port} onClick={() => onSelect(host.name, `${host.address}:${port}`)}>
                  {host.ports.length > 1 ? `使用 ${port}` : '使用此主机'}
                </Button>
              ))
            ) : (
              <Button onClick={() => onSelect(host.name, host.address)}>填入 IP</Button>
            )}
          </div>
        </div>
      ))}
    </section>
  )
}
