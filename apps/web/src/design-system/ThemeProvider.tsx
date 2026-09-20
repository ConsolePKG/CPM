import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
export type ThemeMode = 'system' | 'light' | 'dark'
const ThemeContext = createContext<{ mode: ThemeMode; setMode: (mode: ThemeMode) => void }>({
  mode: 'system',
  setMode: () => {},
})
function initialMode(): ThemeMode {
  try {
    const value = localStorage.getItem('cpm-theme')
    if (value === 'system' || value === 'light' || value === 'dark') return value
    if (localStorage.getItem('isDarkModeAuto') === 'false')
      return localStorage.getItem('isDarkMode') === 'true' ? 'dark' : 'light'
  } catch {
    /* Storage is optional in restricted browsers. */
  }
  return 'system'
}
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(initialMode)
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystemDark(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useLayoutEffect(() => {
    const dark = mode === 'dark' || (mode === 'system' && systemDark)
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    document.body.classList.toggle('dark-mode', dark)
    try {
      localStorage.setItem('cpm-theme', mode)
    } catch {
      /* Optional persistence. */
    }
  }, [mode, systemDark])
  return <ThemeContext.Provider value={{ mode, setMode }}>{children}</ThemeContext.Provider>
}
export const useTheme = () => useContext(ThemeContext)
