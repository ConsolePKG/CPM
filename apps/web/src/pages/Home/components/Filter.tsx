import { Slider } from '@base-ui/react/slider'
import { ArrowLeft, RefreshCw, Search, ChevronDown } from 'react-feather'
import { useState } from 'react'
import { PkgListUIType } from 'common/types/configStore'
import { Button, IconButton, Input, Popover, SegmentedControl, Select } from '@/design-system'
import { useContainer } from '@/store/container'
import type { ContentFilter, LibrarySort } from '../library'
export function Filter({
  count,
  category,
  setCategory,
  sort,
  setSort,
  cardSize,
  setCardSize,
}: {
  count: number
  category: ContentFilter
  setCategory: (value: ContentFilter) => void
  sort: LibrarySort
  setSort: (value: LibrarySort) => void
  cardSize: number
  setCardSize: (value: number) => void
}) {
  const { fileServer, settings, chnageSettings } = useContainer()
  const {
    searchKeyWord,
    setSearchKeyWord,
    curHost,
    fileServerHosts,
    curFileServerHostId,
    setCurFileServerHostId,
    paths,
    setPaths,
    loading,
    pkgInfoDataLoading,
    getServerFileListData,
  } = fileServer
  const [filterOpen, setFilterOpen] = useState(false)
  return (
    <div className="library-toolbar">
      <div className="library-toolbar-left">
        <Popover
          title="筛选与显示"
          open={filterOpen}
          onOpenChange={setFilterOpen}
          trigger={
            <Button
              variant="text"
              className={`library-category ${category !== 'all' ? 'filter-active' : ''}`}
              aria-label="筛选与显示"
            >
              <span>{{ all: '全部游戏', base: '游戏本体', patch: '补丁', addon: 'DLC' }[category]}</span>
              <span className="library-count">{count}</span>
              <ChevronDown size={16} />
            </Button>
          }
        >
          <div className="library-filters">
            <label>内容类型</label>
            <SegmentedControl
              label="内容类型"
              value={category}
              onChange={setCategory}
              options={[
                { value: 'all', label: '全部' },
                { value: 'base', label: '本体' },
                { value: 'patch', label: '补丁' },
                { value: 'addon', label: 'DLC' },
              ]}
            />
            <label>显示方式</label>
            <SegmentedControl
              label="显示方式"
              value={settings.pkgListUIType}
              onChange={(pkgListUIType) => chnageSettings({ pkgListUIType })}
              options={[
                { value: PkgListUIType.card, label: '封面网格' },
                { value: PkgListUIType.table, label: '文件列表' },
              ]}
            />
            <label>封面尺寸</label>
            <Slider.Root
              value={cardSize}
              onValueChange={(value) => setCardSize(Number(value))}
              min={150}
              max={260}
              step={10}
              className="cover-slider"
            >
              <Slider.Control>
                <Slider.Track>
                  <Slider.Indicator />
                  <Slider.Thumb aria-label="封面尺寸" />
                </Slider.Track>
              </Slider.Control>
            </Slider.Root>
            <div className="filter-footer">
              <Button
                variant="text"
                onClick={() => {
                  setCategory('all')
                  setSort('name')
                  setCardSize(200)
                  chnageSettings({ pkgListUIType: PkgListUIType.card })
                }}
              >
                重置
              </Button>
              <Button type="primary" onClick={() => setFilterOpen(false)}>
                完成
              </Button>
            </div>
          </div>
        </Popover>
        <nav className="library-path" aria-label="资源路径">
          {paths.length > 1 && (
            <IconButton label="上一级文件夹" variant="text" onClick={() => setPaths(paths.slice(0, -1))}>
              <ArrowLeft />
            </IconButton>
          )}
          {fileServerHosts.length > 1 ? (
            <Select
              label="资源库"
              value={curFileServerHostId || ''}
              onChange={(id) => {
                setPaths([])
                setCurFileServerHostId(id)
              }}
              options={fileServerHosts.map((host) => ({ value: host.id, label: host.alias || host.url }))}
            />
          ) : (
            <Button variant="text" onClick={() => setPaths([])}>
              {curHost?.alias || '资源'}
            </Button>
          )}
          {paths.filter(Boolean).map((path, index) => (
            <span key={index}> / {path}</span>
          ))}
        </nav>
      </div>
      <div className="library-toolbar-right">
        <div className="library-search">
          <Input
            aria-label="搜索游戏"
            placeholder="搜索游戏…"
            prefix={<Search size={16} />}
            value={searchKeyWord}
            onChange={setSearchKeyWord}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setSearchKeyWord('')
            }}
          />
        </div>
        <Select
          label="排序方式"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'name', label: '名称' },
            { value: 'recent', label: '最近修改' },
            { value: 'size', label: '文件大小' },
          ]}
        />
        <IconButton
          label="刷新游戏库"
          variant="text"
          loading={loading || pkgInfoDataLoading}
          onClick={() => getServerFileListData()}
        >
          <RefreshCw />
        </IconButton>
      </div>
    </div>
  )
}
