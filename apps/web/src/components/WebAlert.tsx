import { Link, Notification } from '@/components/ui'
import { useEffect, useState } from 'react'

const CacheKey = 'WebAlertV1'

const LinkUrl = 'https://github.com/njzydark/ps4_remote_pkg_installer-OOSDK/releases'

export const WebAlert = () => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const cache = localStorage.getItem(CacheKey) === 'true'
    setVisible(cache ? false : true)
  }, [])

  const handleClose = () => {
    localStorage.setItem(CacheKey, 'true')
    setVisible(false)
  }

  useEffect(() => {
    if (!visible || window.electron) {
      return
    }
    Notification.warning({
      id: 'web-alert',
      content: (
        <>
          <span>
            This Web version is mainly used to install files in WebDAV Server (NAS), and you must install this version
            of&nbsp;
          </span>
          <Link
            hoverable={false}
            onClick={() => {
              window.open(LinkUrl)
              handleClose()
              Notification.remove('web-alert')
            }}
          >
            RPI
          </Link>
          <span>&nbsp;on your PS4</span>
        </>
      ),
      duration: 0,
      onClose: handleClose,
    })
  }, [visible])

  return null
}

export const RPILink = () => {
  const handleOpenLink = () => {
    if (window.electron) {
      window.electron.openExternal(LinkUrl)
    } else {
      window.open(LinkUrl)
    }
  }
  return (
    <Link hoverable={false} onClick={handleOpenLink}>
      RPI
    </Link>
  )
}
