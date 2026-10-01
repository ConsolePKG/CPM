import { FileServerHost } from './components/FileServerHost'
import { PS4Host } from './components/PS4Host'
import styles from './Hosts.module.less'

export const Hosts = () => {
  return (
    <div className={styles.page}>
      <div className={styles.intro}>
        <div>
          <span className={styles.eyebrow}>连接管理</span>
          <p>管理游戏文件来源与 PS4 / PS5 安装主机。</p>
        </div>
      </div>
      <div className={styles.sections}>
        <FileServerHost />
        <PS4Host />
      </div>
    </div>
  )
}
