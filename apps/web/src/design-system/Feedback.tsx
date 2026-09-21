import { Progress as BaseProgress } from '@base-ui/react/progress'
import { Package } from 'react-feather'
import type { ReactNode, HTMLAttributes, AnchorHTMLAttributes } from 'react'
export function Progress({
  percent = 0,
  label = '安装进度',
  active = false,
}: {
  percent?: number
  label?: string
  active?: boolean
}) {
  const value = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0
  const animate = active && value >= 10 && value < 100
  return (
    <BaseProgress.Root value={value} className="cpm-progress" data-active={animate || undefined} aria-label={label}>
      <BaseProgress.Track className="cpm-progress-track">
        <BaseProgress.Indicator className="cpm-progress-fill" style={{ height: '100%' }}>
          {animate && (
            <span className="cpm-progress-energy" aria-hidden="true">
              <span className="cpm-progress-front" />
            </span>
          )}
        </BaseProgress.Indicator>
      </BaseProgress.Track>
    </BaseProgress.Root>
  )
}
export function Spin({ tip = '加载中' }: { tip?: string }) {
  return (
    <div className="cpm-spin" role="status">
      <span className="cpm-spinner" />
      {tip}
    </div>
  )
}
export function Empty({ description = '暂无内容', children }: { description?: string; children?: ReactNode }) {
  return (
    <div className="cpm-empty">
      <Package size={32} />
      <p>{description}</p>
      {children}
    </div>
  )
}
export function Alert({
  content,
  children,
  type = 'info',
}: {
  content?: ReactNode
  children?: ReactNode
  type?: string
}) {
  return (
    <div className={`cpm-alert cpm-alert-${type}`} role="note">
      {content ?? children}
    </div>
  )
}
export function Space({
  children,
  direction = 'horizontal',
  size = 'small',
  ...props
}: HTMLAttributes<HTMLDivElement> & { direction?: string; size?: string | number }) {
  return (
    <div
      {...props}
      className={`cpm-space ${direction === 'vertical' ? 'cpm-stack' : ''} ${props.className || ''}`}
      style={{ gap: typeof size === 'number' ? size : 8, ...props.style }}
    >
      {children}
    </div>
  )
}
export function Link({
  hoverable: _hoverable,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { hoverable?: boolean }) {
  return props.href ? (
    <a {...props} className="cpm-link">
      {children}
    </a>
  ) : (
    <a
      {...props}
      role="button"
      tabIndex={0}
      className="cpm-link"
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          event.currentTarget.click()
        }
      }}
    >
      {children}
    </a>
  )
}
export function Result({
  title,
  subTitle,
  extra,
}: {
  title?: ReactNode
  subTitle?: ReactNode
  extra?: ReactNode
  status?: string
}) {
  return (
    <div className="cpm-empty">
      <h2>{title}</h2>
      <p>{subTitle}</p>
      {extra}
    </div>
  )
}
