import { Progress as BaseProgress } from '@base-ui/react/progress'
import { Package } from 'react-feather'
import type { ReactNode, HTMLAttributes, AnchorHTMLAttributes } from 'react'
export function Progress({ percent = 0, label = '安装进度' }: { percent?: number; label?: string }) {
  return (
    <BaseProgress.Root value={Math.max(0, Math.min(100, percent))} className="cpm-progress" aria-label={label}>
      <BaseProgress.Track>
        <BaseProgress.Indicator />
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
