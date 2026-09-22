import { expect, it, rstest } from '@rstest/core'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

rstest.mock('@/utils/browser', () => ({ isPlayStationBrowser: true }))
import { RouteSurface } from '../src/components/RouteSurface'

it('renders PS4 route content immediately without animation styles', () => {
  const markup = renderToStaticMarkup(createElement(RouteSurface, {
    className: 'settings-body',
    role: 'region',
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.2 },
    children: '设置',
  }))
  expect(markup).toBe('<div class="settings-body" role="region">设置</div>')
})
