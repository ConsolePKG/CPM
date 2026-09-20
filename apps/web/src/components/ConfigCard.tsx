import { Button } from '@/design-system'
import type { ReactNode } from 'react'
import './ConfigCard.less'
export function ConfigCard({
  title,
  isActive,
  onClick,
  action,
  meta,
  subTitle,
}: {
  title: string
  isActive?: boolean
  onClick?: () => void
  action?: ReactNode
  meta?: string
  subTitle?: string
}) {
  return (
    <article className={`config-card ${isActive ? 'is-active' : ''}`}>
      <Button variant="text" className="config-card-select" onClick={onClick}>
        <strong>{title}</strong>
        {subTitle && <span>{subTitle}</span>}
        {meta && <small>{meta}</small>}
        <small className="config-status">{isActive ? '✓ 当前使用' : '设为当前'}</small>
      </Button>
      <div className="config-card-actions">{action}</div>
    </article>
  )
}
