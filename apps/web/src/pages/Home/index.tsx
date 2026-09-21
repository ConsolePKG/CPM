import { PkgListClickAction, PkgListUIType } from 'common/types/configStore'
import { useState, type CSSProperties } from 'react'
import { useContainer } from '@/store/container'
import type { FileStat } from '@/types'
import { FileServerHostEmpty } from './components/FileServerHostEmpty'
import { Filter } from './components/Filter'
import { CardList } from './components/CardList'
import { TableList } from './components/TableList'
import { DetailDrawer } from './components/DetailDrawer'
import { filterLibrary, type ContentFilter, type LibrarySort } from './library'
import './library.less'
export function Home() {
  const {
    fileServer: { fileServerFiles, loading, setPaths, searchKeyWord, fileServerHosts, curHost },
    settings,
    handleInstall,
  } = useContainer()
  const [detail, setDetail] = useState<FileStat>()
  const [category, setCategory] = useState<ContentFilter>('all')
  const [sort, setSort] = useState<LibrarySort>('name')
  const [cardSize, setCardSize] = useState(200)
  const hasLibrary = fileServerHosts.length > 0 && Boolean(curHost)
  const data = filterLibrary(fileServerFiles, searchKeyWord, category, sort, settings.displayPkgRawTitle)
  const onAction = (file: FileStat, action: PkgListClickAction) => {
    if (file.type === 'directory') setPaths(file.filename.replace(/\\/g, '/').split('/'))
    else if (
      action === PkgListClickAction.install ||
      (action === PkgListClickAction.auto && settings.pkgListClickAction === PkgListClickAction.install)
    )
      void handleInstall(file)
    else setDetail(file)
  }
  const props = { data, loading, displayPkgRawTitle: settings.displayPkgRawTitle, handleInstallByActionType: onAction }
  return (
    <div className="library" style={{ '--cover-min': `${cardSize}px` } as CSSProperties}>
      {hasLibrary && (
        <Filter
          count={data.filter((file) => file.type !== 'directory').length}
          category={category}
          setCategory={setCategory}
          sort={sort}
          setSort={setSort}
          cardSize={cardSize}
          setCardSize={setCardSize}
        />
      )}
      {!hasLibrary ? (
        <FileServerHostEmpty />
      ) : settings.pkgListUIType === PkgListUIType.table ? (
        <TableList {...props} />
      ) : (
        <CardList {...props} />
      )}
      <DetailDrawer
        visible={Boolean(detail)}
        data={detail}
        displayPkgRawTitle={settings.displayPkgRawTitle}
        handleCancel={() => setDetail(undefined)}
        handleInstallByActionType={onAction}
      />
    </div>
  )
}
export default Home
