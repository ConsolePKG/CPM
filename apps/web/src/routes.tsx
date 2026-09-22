import { useLocation, useRoutes, type Location, type RouteObject } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { NotFound } from './pages/NotFound'
import { Settings } from './pages/Settings'
import { GameDetailPage } from './pages/Home/components/GameDetailPage'
import type { FileStat } from './types'
import { Tasks } from './pages/Tasks'
import { isPlayStationBrowser } from './utils/browser'
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
export type GameLocationState = { backgroundLocation?: Location; file?: FileStat }
export type SettingsLocationState = { backgroundLocation?: Location }
export const useRouterElement = () => {
  const location = useLocation()
  const isSettings = location.pathname === '/hosts' || location.pathname.startsWith('/settings')
  const background = (location.state as SettingsLocationState | null)?.backgroundLocation
  const contentLocation = isSettings ? background || location : location
  const isGame = contentLocation.pathname === '/game'
  const gameState = contentLocation.state as GameLocationState | null
  const main = useRoutes(
    routes,
    isGame
      ? gameState?.backgroundLocation || { pathname: '/' }
      : isSettings
        ? background || { pathname: '/' }
        : location,
  )
  return (
    <>
      <div className={isPlayStationBrowser && (isGame || isSettings) ? 'ps4-background-page' : undefined}>
        {main}
      </div>
      {isGame && <GameDetailPage data={gameState?.file} hasBackground={Boolean(gameState?.backgroundLocation)} />}
      {isSettings && <Settings />}
    </>
  )
}
