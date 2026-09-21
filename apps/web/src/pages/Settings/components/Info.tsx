import { Button, Link } from '@/components/ui'
import { IconGithub } from '@/components/icons'
import { useEffect, useState } from 'react'

import Icon from '@/assets/icon.svg'

import styles from './Info.module.less'

const LinkUrl = 'https://github.com/njzydark/PS4RPS'

export const Info = () => {
  const [appInfo, setAppInfo] = useState<{
    version: string
    name: string
    path: string
  }>()

  useEffect(() => {
    const getAppInfo = async () => {
      if (!window.electron) {
        return
      }
      const appInfo = await window.electron.getAppInfo()
      if (appInfo) {
        setAppInfo(appInfo)
      }
    }

    if (window.electron) {
      getAppInfo()
    } else {
      setAppInfo({
        name: 'PS4RPS',
        version: _app_version,
        path: '',
      })
    }
  }, [])

  const handleOpenLink = () => {
    if (window.electron) {
      window.electron.openExternal(LinkUrl)
    } else {
      window.open(LinkUrl)
    }
  }

  if (!appInfo) {
    return null
  }

  return (
    <section className={styles.info}>
      <div className={styles.identity}>
        <img src={Icon} width={64} height={64} alt="PS4RPS" />
        <div>
          <h2>{appInfo.name}</h2>
          <p>{appInfo.version}</p>
        </div>
      </div>
      <div className={styles.actions}>
        <Link
          href={LinkUrl}
          onClick={(event) => {
            event.preventDefault()
            handleOpenLink()
          }}
        >
          GitHub <IconGithub aria-hidden="true" />
        </Link>
        {window.electron && <Button onClick={() => window.electron?.checkUpdate()}>Check for updates</Button>}
      </div>
    </section>
  )
}
