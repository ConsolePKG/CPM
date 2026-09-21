import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Settings, Grid, Download } from 'react-feather'
import { IconButton } from '@/design-system'
import { useContainer } from '@/store/container'
import Logo from '@/assets/icon.svg'
import { HostSwitcher } from './HostSwitcher'
export function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const { settings } = useContainer()
  return (
    <header className="app-header">
      <NavLink className="app-brand" to="/" aria-label="CPM 游戏库">
        {settings.displayLogo && <img src={Logo} alt="" />}
        <span>CPM</span>
      </NavLink>
      <nav className="app-tabs" aria-label="主导航">
        <NavLink end to="/">
          <Grid className="app-tab-icon" size={20} aria-hidden="true" />
          <span>游戏库</span>
        </NavLink>
        <NavLink to="/tasks">
          <Download className="app-tab-icon" size={20} aria-hidden="true" />
          <span>安装任务</span>
        </NavLink>
      </nav>
      <div className="app-header-actions">
        <HostSwitcher />
        <IconButton
          id="settings-trigger"
          label="设置"
          onClick={() => navigate('/settings/general', { state: { backgroundLocation: location } })}
        >
          <Settings />
        </IconButton>
      </div>
    </header>
  )
}
