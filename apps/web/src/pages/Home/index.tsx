import { PkgListClickAction, PkgListUIType } from 'common/types/configStore'
import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useContainer } from '@/store/container'
import type { FileStat } from '@/types'
import { FileServerHostEmpty } from './components/FileServerHostEmpty'
import { Filter } from './components/Filter'
import { CardList } from './components/CardList'
import { TableList } from './components/TableList'
import { useLocation, useNavigate } from 'react-router-dom'
import { filterLibrary, type ContentFilter, type LibrarySort } from './library'
import './library.less'
export function Home() {
  const {
    fileServer: { fileServerFiles, loading, setPaths, searchKeyWord, fileServerHosts, curHost },
    settings,
    handleInstall,
  } = useContainer()
  const navigate = useNavigate()
  const location = useLocation()
  const [category, setCategory] = useState<ContentFilter>('all')
  const [sort, setSort] = useState<LibrarySort>('name')
  const [cardSize, setCardSize] = useState(200)
  const hasLibrary = fileServerHosts.length > 0 && Boolean(curHost)
  const data = useMemo(
    () => filterLibrary(fileServerFiles, searchKeyWord, category, sort, settings.displayPkgRawTitle),
    [fileServerFiles, searchKeyWord, category, sort, settings.displayPkgRawTitle],
  )
  const detailOrder = useMemo(
    () => data.filter((file) => file.type !== 'directory').map((file) => file.filename),
    [data],
  )
  const handleInstallRef = useRef(handleInstall)
  handleInstallRef.current = handleInstall
  const onAction = useCallback(
    (file: FileStat, action: PkgListClickAction) => {
      if (file.type === 'directory') setPaths(file.filename.replace(/\\/g, '/').split('/'))
      else if (
        action === PkgListClickAction.install ||
        (action === PkgListClickAction.auto && settings.pkgListClickAction === PkgListClickAction.install)
      )
        void handleInstallRef.current(file)
      else navigate('/game', { state: { backgroundLocation: location, file, detailOrder } })
    },
    [detailOrder, location, navigate, setPaths, settings.pkgListClickAction],
  )
  const props = {
    data,
    loading,
    displayPkgRawTitle: settings.displayPkgRawTitle,
    clickAction: settings.pkgListClickAction,
    handleInstallByActionType: onAction,
  }
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
    </div>
  )
}
export default Home
