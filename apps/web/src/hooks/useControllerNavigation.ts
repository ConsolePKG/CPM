import { useEffect } from 'react'
import { isPlayStationBrowser } from '@/utils/browser'
import { useLocation, useNavigate } from 'react-router-dom'
// Geometric navigation follows the actual responsive layout, including portal dialogs.
export function useControllerNavigation() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useEffect(() => {
    // PS4 already provides controller navigation. A second input loop can
    // duplicate clicks/movement and repeatedly force layout during native scroll.
    if (isPlayStationBrowser) return
    let frame = 0
    let previous: boolean[] = []
    let lastMove = 0
    function move(direction: string) {
      const focus = document.activeElement as HTMLElement | null
      if (focus?.matches('input,textarea,select,[role="slider"],[role="combobox"]')) return
      const modal = [...document.querySelectorAll<HTMLElement>('[role="dialog"],[role="alertdialog"]')].at(-1)
      const candidates = [
        ...(modal || document).querySelectorAll<HTMLElement>(
          'button,a[href],[role="radio"],[role="switch"],[tabindex="0"]',
        ),
      ].filter(
        (el) => !el.matches(':disabled,[aria-disabled="true"]') && !el.closest('[inert]') && el.getClientRects().length,
      )
      if (!focus || !candidates.includes(focus)) {
        candidates[0]?.focus()
        return
      }
      const source = focus.getBoundingClientRect()
      const scored = candidates
        .filter((el) => el !== focus)
        .map((el) => {
          const rect = el.getBoundingClientRect()
          const dx = rect.x + rect.width / 2 - source.x - source.width / 2
          const dy = rect.y + rect.height / 2 - source.y - source.height / 2
          const primary =
            direction === 'ArrowRight' ? dx : direction === 'ArrowLeft' ? -dx : direction === 'ArrowDown' ? dy : -dy
          return {
            el,
            primary,
            score: primary + Math.abs(direction === 'ArrowRight' || direction === 'ArrowLeft' ? dy : dx) * 3,
          }
        })
        .filter((item) => item.primary > 8)
        .sort((a, b) => a.score - b.score)
      scored[0]?.el.focus()
    }
    const keyboard = (event: KeyboardEvent) => {
      if (/PlayStation/i.test(navigator.userAgent) && event.key.startsWith('Arrow')) {
        move(event.key)
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', keyboard)
    function poll(time: number) {
      const pad = navigator.getGamepads?.().find((item) => item?.connected)
      if (pad) {
        pad.buttons.forEach((button, index) => {
          if (button.pressed && !previous[index]) {
            if (index === 0) (document.activeElement as HTMLElement)?.click()
            if (index === 1) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
            if ((index === 4 || index === 5) && !document.querySelector('[role="dialog"]'))
              navigate(pathname === '/tasks' ? '/' : '/tasks')
          }
        })
        const direction =
          pad.buttons[12]?.pressed || pad.axes[1] < -0.6
            ? 'ArrowUp'
            : pad.buttons[13]?.pressed || pad.axes[1] > 0.6
              ? 'ArrowDown'
              : pad.buttons[14]?.pressed || pad.axes[0] < -0.6
                ? 'ArrowLeft'
                : pad.buttons[15]?.pressed || pad.axes[0] > 0.6
                  ? 'ArrowRight'
                  : ''
        if (direction && time - lastMove > 180) {
          move(direction)
          lastMove = time
        }
        previous = pad.buttons.map((button) => button.pressed)
      } else previous = []
      frame = requestAnimationFrame(poll)
    }
    frame = requestAnimationFrame(poll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', keyboard)
    }
  }, [navigate, pathname])
}
