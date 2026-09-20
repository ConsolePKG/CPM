import { Provider } from '@/store/container'
import { NotificationProvider, ThemeProvider } from '@/design-system'
import { WebAlert } from './components/WebAlert'
import { useRouterElement } from './routes'
export const App = () => {
  const routes = useRouterElement()
  return (
    <ThemeProvider>
      <NotificationProvider>
        <Provider>
          <WebAlert />
          {routes}
        </Provider>
      </NotificationProvider>
    </ThemeProvider>
  )
}
