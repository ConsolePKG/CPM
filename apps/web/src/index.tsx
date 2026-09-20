import './index.less'

import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'

const Router = HashRouter

import { App } from './app'
import { CustomErrorBoundary } from './components/CustomErrorBoundary'

const rootEl = document.createElement('div')
rootEl.id = 'root'
document.body.appendChild(rootEl)

createRoot(rootEl).render(
  <CustomErrorBoundary title="Global Error message" showDialog>
    <Router>
      <App />
    </Router>
  </CustomErrorBoundary>,
)
