import { expect, it } from '@rstest/core'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { runInNewContext } from 'node:vm'

// happy-dom itself requires WeakRef. Exercise the installed focus manager in an
// isolated old-browser context instead of disabling WeakRef in the DOM emulator.
const require = createRequire(import.meta.url)
const source = readFileSync(
  path.resolve(
    path.dirname(require.resolve('@base-ui/react/dialog')),
    '../floating-ui-react/components/FloatingFocusManager.mjs',
  ),
  'utf8',
)
const historyCode = source.slice(source.indexOf('const LIST_LIMIT'), source.indexOf('function getFirstTabbableElement'))

it('preserves focus history without WeakRef and discards disconnected elements', () => {
  const history = runInNewContext(
    `${historyCode}\n({ add: addPreviouslyFocusedElement, get: getPreviouslyFocusedElement })`,
    {
      WeakRef: undefined,
      getNodeName: (element: { nodeName: string }) => element.nodeName.toLowerCase(),
    },
  )
  const trigger = { nodeName: 'BUTTON', isConnected: true }
  const nestedTrigger = { nodeName: 'BUTTON', isConnected: true }
  history.add(trigger)
  history.add(nestedTrigger)
  expect(history.get()).toBe(nestedTrigger)
  nestedTrigger.isConnected = false
  expect(history.get()).toBe(trigger)
  trigger.isConnected = false
  expect(history.get()).toBeUndefined()
})

it('bounds the fallback focus history to 20 entries', () => {
  const history = runInNewContext(
    `${historyCode}\n({ add: addPreviouslyFocusedElement, get: getPreviouslyFocusedElement })`,
    {
      WeakRef: undefined,
      getNodeName: () => 'button',
    },
  )
  const first = { isConnected: true }
  history.add(first)
  const later = Array.from({ length: 20 }, () => ({ isConnected: true }))
  later.forEach((element) => history.add(element))
  later.forEach((element) => {
    element.isConnected = false
  })
  expect(history.get()).toBeUndefined()
})
