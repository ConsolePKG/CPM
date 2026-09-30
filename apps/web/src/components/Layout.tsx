import { useControllerNavigation } from '@/hooks/useControllerNavigation'
import { Outlet } from 'react-router-dom'
import { CustomErrorBoundary } from './CustomErrorBoundary'
import { AppHeader } from './shell/AppHeader'
import './shell/shell.less'
export const Layout = () => {
  useControllerNavigation()
  const isMacDesktop = window.electron?.platform === 'darwin'
  return (
    <div className={`app-shell${window.electron ? ' app-shell-desktop' : ''}${isMacDesktop ? ' app-shell-mac' : ''}`}>
      <AppHeader />
      <main className="app-content">
        <CustomErrorBoundary>
          <Outlet />
        </CustomErrorBoundary>
      </main>
    </div>
  )
}
