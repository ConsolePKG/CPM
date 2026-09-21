import cs from 'classnames'
import { Minus, Square, X } from 'react-feather'

import icon from '@/assets/icon.svg'

import styles from './TitleBar.module.less'

export const TitleBar = () => {
  const isMacOS = window.electron && window.electron.platform === 'darwin'

  return (
    <div className={styles.wrapper} style={{ justifyContent: isMacOS ? 'center' : 'flex-start' }}>
      <div className={styles['title-wrapper']}>
        {!isMacOS && <img src={icon} alt="icon" />}
        <span>PS4RPS</span>
      </div>
      <div className={styles['btn-wrapper']}>
        <div className={styles.btn} onClick={() => window.electron && window.electron.chnageWindowStatus('minimize')}>
          <Minus />
        </div>
        <div className={styles.btn} onClick={() => window.electron && window.electron.chnageWindowStatus('maximize')}>
          <Square />
        </div>
        <div
          className={cs(styles.btn, styles.danger)}
          onClick={() => window.electron && window.electron.chnageWindowStatus('close')}
        >
          <X />
        </div>
      </div>
    </div>
  )
}
