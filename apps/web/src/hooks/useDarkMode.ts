import { useEffect, useState } from 'react'

const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)'

const getMatches = (query: string): boolean => {
  if (typeof window !== 'undefined') {
    return window?.matchMedia?.(query)?.matches
  }
  return false
}

type CacheKey = 'isDarkModeAuto' | 'isDarkMode'

const getCacheFromLocalStorage = (key: CacheKey): string | null => {
  return localStorage.getItem(key)
}

export const useDarkMode = () => {
  const [auto, setAuto] = useState(() => {
    const isDarkModeAuto = getCacheFromLocalStorage('isDarkModeAuto')
    return isDarkModeAuto ? isDarkModeAuto === 'true' : true
  })
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const isDarkModeAuto = getCacheFromLocalStorage('isDarkModeAuto') === 'true'
    const isDarkMode = getCacheFromLocalStorage('isDarkMode') === 'true'
    return isDarkModeAuto ? getMatches(COLOR_SCHEME_QUERY) : isDarkMode
  })

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode')
    } else {
      document.body.classList.remove('dark-mode')
    }
  }, [isDarkMode])

  useEffect(() => {
    if (!auto) {
      return
    }
    const handler = (e: MediaQueryListEvent) => {
      console.log('Detect darkmode change', e.matches)
      if (e.matches) {
        setIsDarkMode(true)
      } else {
        setIsDarkMode(false)
      }
    }
    const isDarkMode = getMatches(COLOR_SCHEME_QUERY)
    if (isDarkMode) {
      setIsDarkMode(true)
    } else {
      setIsDarkMode(false)
    }
    const wm = window?.matchMedia?.('(prefers-color-scheme: dark)')
    wm?.addEventListener?.('change', handler)
    return () => {
      wm?.removeEventListener?.('change', handler)
    }
  }, [auto])

  useEffect(() => {
    localStorage.setItem('isDarkModeAuto', auto ? 'true' : 'false')
    localStorage.setItem('isDarkMode', isDarkMode ? 'true' : 'false')
  }, [isDarkMode, auto])

  return {
    isDarkMode,
    setIsDarkMode,
    auto,
    setAuto,
  }
}
