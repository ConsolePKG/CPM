import { Button as Primitive } from '@base-ui/react/button'
import { forwardRef, type ComponentProps, type ReactNode } from 'react'
import cs from 'classnames'
export type ButtonProps = Omit<ComponentProps<typeof Primitive>, 'type' | 'className' | 'ref'> & {
  type?: 'primary' | 'default' | 'text' | 'button' | 'submit'
  variant?: 'primary' | 'default' | 'text' | 'danger'
  className?: string
  loading?: boolean
  icon?: ReactNode
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { type = 'button', variant, className, loading, icon, children, disabled, ...props },
  ref,
) {
  const tone = variant || (['primary', 'text', 'default'].includes(type) ? type : 'default')
  return (
    <Primitive
      {...props}
      ref={ref}
      type={type === 'submit' ? 'submit' : 'button'}
      className={cs('cpm-button', `cpm-button-${tone}`, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="cpm-spinner" /> : icon}
      {children}
    </Primitive>
  )
})
export function IconButton({ label, ...props }: ButtonProps & { label: string }) {
  return <Button {...props} aria-label={label} title={label} className={cs('cpm-icon-button', props.className)} />
}
