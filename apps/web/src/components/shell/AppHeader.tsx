import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Settings } from 'react-feather'
import { IconButton } from '@/design-system'
import { useContainer } from '@/store/container'
import Logo from '@/assets/icon.png'
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
          游戏库
        </NavLink>
        <NavLink to="/tasks">安装任务</NavLink>
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
