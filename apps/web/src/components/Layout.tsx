import { useControllerNavigation } from '@/hooks/useControllerNavigation'
import { Outlet } from 'react-router-dom'
import { CustomErrorBoundary } from './CustomErrorBoundary'
import { AppHeader } from './shell/AppHeader'
import './shell/shell.less'
export const Layout = () => {
  useControllerNavigation()
  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-content">
        <CustomErrorBoundary>
          <Outlet />
        </CustomErrorBoundary>
      </main>
    </div>
  )
}
