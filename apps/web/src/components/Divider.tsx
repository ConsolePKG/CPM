import { CSSProperties } from 'react'

type Props = {
  className?: string
  style?: CSSProperties
}

export const Divider = ({ className, style }: Props) => {
  return (
    <div
      className={className}
      style={{
        height: '1px',
        margin: '10px 0',
        width: '100%',
        background: 'var(--rps-border-color)',
        ...style,
      }}
    ></div>
  )
}
