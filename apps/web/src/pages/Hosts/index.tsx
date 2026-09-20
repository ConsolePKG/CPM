import { FileServerHost } from './components/FileServerHost'
import { PS4Host } from './components/PS4Host'
import styles from './Hosts.module.less'

export const Hosts = () => {
  return (
    <div className={styles.page}>
      <div className={styles.intro}>
        <div>
          <span className={styles.eyebrow}>Connections</span>
          <p>Manage the game source and PS4 endpoint used by the library.</p>
        </div>
      </div>
      <div className={styles.sections}>
        <FileServerHost />
        <PS4Host />
      </div>
    </div>
  )
}
