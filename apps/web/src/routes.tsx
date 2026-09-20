import { useLocation, useRoutes, type Location, type RouteObject } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { NotFound } from './pages/NotFound'
import { Settings } from './pages/Settings'
import { Tasks } from './pages/Tasks'
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'tasks', element: <Tasks /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]
export type SettingsLocationState = { backgroundLocation?: Location }
export const useRouterElement = () => {
  const location = useLocation()
  const isSettings = location.pathname === '/hosts' || location.pathname.startsWith('/settings')
  const background = (location.state as SettingsLocationState | null)?.backgroundLocation
  const main = useRoutes(routes, isSettings ? background || { pathname: '/' } : location)
  return (
    <>
      {main}
      {isSettings && <Settings />}
    </>
  )
}
