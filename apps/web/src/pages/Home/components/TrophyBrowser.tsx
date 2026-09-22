import { useState } from 'react'
import { Award, Download, Search } from 'react-feather'
import type { Trophy, TrophySet } from '@njzy/ps4-pkg-info/web'
import { Button, Checkbox, Disclosure, Input, Select } from '@/design-system'
import trophySilhouette from '@/assets/trophies/trophy.svg'

const grades = ['白金', '金', '银', '铜']
const gradeClass = (grade: string) => ['platinum', 'gold', 'silver', 'bronze'][grades.indexOf(grade)] || 'unknown'

function GradeIcon({ grade, size = 24 }: { grade: string; size?: number }) {
  return (
    <span
      className={`trophy-grade-icon ${gradeClass(grade)}`}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        maskImage: `url(${trophySilhouette})`,
        WebkitMaskImage: `url(${trophySilhouette})`,
      }}
    />
  )
}

function TrophyRow({ trophy, prefix }: { trophy: Trophy; prefix: string }) {
  return (
    <li className="trophy-row">
      {trophy.icon ? (
        <img src={trophy.icon} alt="" loading="lazy" />
      ) : (
        <span className="pkg-trophy-placeholder">
          <GradeIcon grade={trophy.grade} size={28} />
        </span>
      )}
      <div className="trophy-row-content">
        <div className="trophy-row-heading">
          <h3>{trophy.name || `奖杯 ${trophy.id}`}</h3>
          <span className={`trophy-grade ${gradeClass(trophy.grade)}`}>
            <GradeIcon grade={trophy.grade} size={14} />
            {trophy.grade || '未知等级'}
          </span>
          {trophy.hidden && <span className="trophy-hidden">隐藏</span>}
        </div>
        {trophy.description &&
          (trophy.description.length > 180 ? (
            <Disclosure className="trophy-description-more" title="查看完整描述">
              <p className="trophy-description">{trophy.description}</p>
            </Disclosure>
          ) : (
            <p className="trophy-description">{trophy.description}</p>
          ))}
        <span className="trophy-id">#{trophy.id}</span>
      </div>
      {trophy.icon && (
        <a
          className="trophy-export"
          href={trophy.icon}
          download={`${prefix}-trophy-${trophy.id}.png`}
          aria-label={`导出 ${trophy.name || `奖杯 ${trophy.id}`} 图标`}
          title="导出图标"
        >
          <Download size={15} />
        </a>
      )}
    </li>
  )
}

export function TrophySkeleton() {
  return (
    <div className="trophy-skeleton" role="status" aria-label="正在读取奖杯信息">
      <span>正在读取奖杯信息…</span>
      {[0, 1, 2].map((id) => (
        <div key={id} aria-hidden="true">
          <i />
          <div>
            <b />
            <b />
          </div>
        </div>
      ))}
    </div>
  )
}

export function TrophyBrowser({ data, prefix, retry }: { data: TrophySet; prefix: string; retry: () => void }) {
  const [query, setQuery] = useState('')
  const [grade, setGrade] = useState('')
  const [hiddenOnly, setHiddenOnly] = useState(false)
  const { trophies, warning, npCommunicationId, metadataName } = data
  const search = query.trim().toLocaleLowerCase()
  const filtered = trophies.filter(
    (trophy) =>
      (!grade || trophy.grade === grade) &&
      (!hiddenOnly || trophy.hidden) &&
      (!search || `${trophy.name} ${trophy.description}`.toLocaleLowerCase().includes(search)),
  )
  const groups = new Map<string, Trophy[]>()
  for (const trophy of filtered) {
    const name = trophy.group || '未分组'
    groups.set(name, [...(groups.get(name) || []), trophy])
  }
  const clear = () => {
    setQuery('')
    setGrade('')
    setHiddenOnly(false)
  }
  const hasFilter = Boolean(search || grade || hiddenOnly)
  return (
    <div className="pkg-trophies">
      <div className="trophy-overview">
        <div className="trophy-total">
          <strong>{trophies.length}</strong>
          <span>{warning ? '可读取的奖杯' : '个奖杯'}</span>
        </div>
        <div className="trophy-grade-counts" aria-label="奖杯等级统计">
          {grades.map((name) => (
            <div
              key={name}
              className={`trophy-count ${gradeClass(name)}`}
              aria-label={`${name} ${trophies.filter((trophy) => trophy.grade === name).length}`}
              title={name}
            >
              <GradeIcon grade={name} size={26} />
              <strong>{trophies.filter((trophy) => trophy.grade === name).length}</strong>
            </div>
          ))}
        </div>
      </div>
      {warning && (
        <div className="trophy-notice" role="status">
          <div>
            <strong>部分奖杯信息暂不可用</strong>
            <p>{warning}</p>
            <span>以下保留可读取的内容。</span>
          </div>
          <Button onClick={retry}>重试</Button>
        </div>
      )}
      {trophies.length > 0 && (
        <div className="trophy-filters">
          <Input
            className="trophy-search"
            type="search"
            aria-label="搜索奖杯"
            placeholder="搜索奖杯名称或描述"
            value={query}
            onChange={setQuery}
            prefix={<Search size={16} aria-hidden="true" />}
          />
          <Select
            label="奖杯等级"
            value={grade}
            onChange={setGrade}
            options={[{ value: '', label: '全部等级' }, ...grades.map((name) => ({ value: name, label: name }))]}
          />
          <Checkbox className="trophy-hidden-filter" checked={hiddenOnly} onChange={setHiddenOnly} label="仅隐藏奖杯" />
        </div>
      )}
      {hasFilter && (
        <div className="trophy-filter-result" role="status">
          <span>
            显示 {filtered.length} / {trophies.length} 个奖杯
          </span>
          <Button variant="text" onClick={clear}>
            清除筛选
          </Button>
        </div>
      )}
      {!filtered.length && (
        <div className="trophy-empty">
          <Award size={28} aria-hidden="true" />
          <p>{hasFilter ? '没有符合条件的奖杯' : '未找到可展示的奖杯'}</p>
          {hasFilter && <Button onClick={clear}>清除筛选</Button>}
        </div>
      )}
      {[...groups]
        .sort(([a], [b]) => (a === '本体' ? -1 : b === '本体' ? 1 : 0))
        .map(([name, items]) => (
          <Disclosure
            className="trophy-group"
            key={name}
            defaultOpen
            title={
              <>
                {name}
                <span className="trophy-group-count">{items.length} 个奖杯</span>
              </>
            }
          >
            <ul>
              {items.map((trophy) => (
                <TrophyRow key={trophy.id} trophy={trophy} prefix={prefix} />
              ))}
            </ul>
          </Disclosure>
        ))}
      {(npCommunicationId || metadataName) && (
        <Disclosure className="trophy-technical" title="技术信息">
          <dl>
            {npCommunicationId && (
              <>
                <dt>NPWR 标识</dt>
                <dd>{npCommunicationId}</dd>
              </>
            )}
            {metadataName && (
              <>
                <dt>元数据文件</dt>
                <dd>{metadataName}</dd>
              </>
            )}
          </dl>
        </Disclosure>
      )}
    </div>
  )
}
