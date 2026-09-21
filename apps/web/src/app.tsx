import { Provider } from '@/store/container'
import { NotificationProvider, ThemeProvider } from '@/design-system'
import { WebAlert } from './components/WebAlert'
import { useRouterElement } from './routes'
import { useLocation } from 'react-router-dom'
import { HostFormsProvider } from './hooks/useHostForms'
import { HostFormDialogs } from './components/HostFormDialogs'
export const App = () => {
  const routes = useRouterElement()
  const { pathname } = useLocation()
  const inSettings = pathname.startsWith('/settings') || pathname === '/hosts'
  return (
    <ThemeProvider>
      <NotificationProvider>
        <HostFormsProvider>
          <Provider>
            <WebAlert />
            {routes}
            {!inSettings && <HostFormDialogs />}
          </Provider>
        </HostFormsProvider>
      </NotificationProvider>
    </ThemeProvider>
  )
}
