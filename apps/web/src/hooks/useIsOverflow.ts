import { RefObject, useLayoutEffect, useState } from 'react'

export const useIsOverflow = (
  ref: RefObject<HTMLDivElement | undefined>,
  options?: {
    isVerticalOverflow?: boolean
    enabled?: boolean
  },
  callback?: (flag: boolean) => void,
) => {
  const [isOverflow, setIsOverflow] = useState(false)

  const { isVerticalOverflow = true, enabled = true } = options || {}

  useLayoutEffect(() => {
    const target = ref.current

    let resizeObserver: ResizeObserver
    let mutationObserver: MutationObserver

    const trigger = () => {
      if (!target || !enabled) {
        return
      }

      const { clientHeight, scrollHeight, clientWidth, scrollWidth } = ref.current
      const hasOverflow = isVerticalOverflow ? scrollHeight > clientHeight : scrollWidth > clientWidth

      setIsOverflow(hasOverflow)

      if (callback) callback(hasOverflow)
    }

    if (target) {
      if ('ResizeObserver' in window) {
        resizeObserver = new ResizeObserver(trigger)
        resizeObserver.observe(target)
      }

      if ('MutationObserver' in window) {
        mutationObserver = new MutationObserver(trigger)
        mutationObserver.observe(target, { childList: true })
      }

      trigger()
    }

    return () => {
      if (mutationObserver) {
        mutationObserver.disconnect()
      }

      if (resizeObserver) {
        resizeObserver.disconnect()
      }
    }
  }, [callback, ref, enabled, isVerticalOverflow])

  return isOverflow
}
