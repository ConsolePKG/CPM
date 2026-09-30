import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useRef } from 'react'
import { Settings, Grid, Download } from 'react-feather'
import { IconButton } from '@/design-system'
import { useContainer } from '@/store/container'
import Logo from '@/assets/icon.svg'
import { isPlayStationBrowser } from '@/utils/browser'
import { recordLibraryDiagnostics } from '@/utils/libraryDiagnostics'
import { HostSwitcher } from './HostSwitcher'
export function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const { settings } = useContainer()
  const lastInput = useRef<{ at: number; type: string } | undefined>(undefined)
  const measureNavigation = (target: string) => {
    if (!isPlayStationBrowser) return
    const startedAt = performance.now()
    const input = lastInput.current
    lastInput.current = undefined
    const navigationInputMs = input && startedAt - input.at < 2000 ? Math.round(startedAt - input.at) : undefined
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const navigationMs = Math.round(performance.now() - startedAt)
        recordLibraryDiagnostics({
          navigationTo: target,
          navigationMs,
          navigationInputMs,
          navigationInputType: navigationInputMs === undefined ? '仅收到 click' : input?.type,
          ...(target === '安装任务' ? { tasksNavigationMs: navigationMs } : {}),
          ...(target === '设置' ? { settingsNavigationMs: navigationMs } : {}),
        })
      })
    })
  }
  return (
    <header
      className="app-header"
      onKeyDownCapture={(event) => {
        if (isPlayStationBrowser && !event.key.startsWith('Arrow')) {
          lastInput.current = { at: performance.now(), type: `keydown ${event.key}` }
        }
      }}
      onPointerDownCapture={() => {
        if (isPlayStationBrowser) lastInput.current = { at: performance.now(), type: 'pointerdown' }
      }}
    >
      <NavLink className="app-brand" to="/" aria-label="CPM 游戏库" onClick={() => measureNavigation('游戏库')}>
        {settings.displayLogo && <img src={Logo} alt="" />}
        <span>CPM</span>
      </NavLink>
      <nav className="app-tabs" aria-label="主导航">
        <NavLink
          end
          to="/"
          className={({ isActive }) => (isActive || location.pathname === '/game' ? 'active' : undefined)}
          onClick={() => measureNavigation('游戏库')}
        >
          <Grid className="app-tab-icon" size={20} aria-hidden="true" />
          <span>游戏库</span>
        </NavLink>
        <NavLink to="/tasks" onClick={() => measureNavigation('安装任务')}>
          <Download className="app-tab-icon" size={20} aria-hidden="true" />
          <span>安装任务</span>
        </NavLink>
      </nav>
      <div className="app-header-actions">
        <HostSwitcher />
        <IconButton
          id="settings-trigger"
          label="设置"
          onClick={() => {
            measureNavigation('设置')
            navigate('/settings/general', { state: { backgroundLocation: location } })
          }}
        >
          <Settings />
        </IconButton>
      </div>
    </header>
  )
}
