import './index.less'
import './ps4.less'
import { isPlayStationBrowser } from './utils/browser'

import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'

const Router = HashRouter

import { App } from './app'
import { CustomErrorBoundary } from './components/CustomErrorBoundary'

const rootEl = document.createElement('div')
if (isPlayStationBrowser) document.documentElement.classList.add('ps4-browser')
rootEl.id = 'root'
document.body.appendChild(rootEl)

createRoot(rootEl).render(
  <CustomErrorBoundary title="Global Error message" showDialog>
    <Router>
      <App />
    </Router>
  </CustomErrorBoundary>,
)
