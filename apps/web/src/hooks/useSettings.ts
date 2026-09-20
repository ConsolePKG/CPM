import { defaultSettings } from 'common/constants/settings'
import { Settings } from 'common/types/configStore'
import { useEffect, useState } from 'react'

import { getInitConfigFromStore, updateConfigStore } from '@/utils'

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(() => {
    const cache = getInitConfigFromStore('settings', defaultSettings)
    return Object.assign({}, defaultSettings, cache)
  })

  const chnageSettings = (newSettings: Partial<Settings>) => {
    setSettings((pre) => ({ ...pre, ...newSettings }))
  }

  useEffect(() => {
    updateConfigStore('settings', settings)
  }, [settings])

  return {
    settings,
    chnageSettings,
  }
}
