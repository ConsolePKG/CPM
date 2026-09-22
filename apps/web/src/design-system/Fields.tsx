import { Input as Primitive } from '@base-ui/react/input'
import { Select as BaseSelect } from '@base-ui/react/select'
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import { Switch as BaseSwitch } from '@base-ui/react/switch'
import { RadioGroup } from '@base-ui/react/radio-group'
import { Radio } from '@base-ui/react/radio'
import { Field } from '@base-ui/react/field'
import { Check, ChevronDown } from 'react-feather'
import { forwardRef, useId, type ComponentProps, type ReactNode } from 'react'
import cs from 'classnames'
export type InputProps = Omit<ComponentProps<typeof Primitive>, 'onChange' | 'className' | 'prefix'> & {
  onChange?: (value: string) => void
  prefix?: ReactNode
  className?: string
}
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { onChange, prefix, className, ...props },
  ref,
) {
  return (
    <span className={cs('cpm-input-shell', className)}>
      {prefix && <span className="cpm-input-prefix">{prefix}</span>}
      <Primitive {...props} ref={ref} className="cpm-input" onChange={(event) => onChange?.(event.target.value)} />
    </span>
  )
})
export function FormField({
  label,
  children,
  error,
  hint,
  name,
}: {
  label: string
  children: ReactNode
  error?: string
  hint?: ReactNode
  name?: string
}) {
  return (
    <Field.Root name={name} className="cpm-form-field" invalid={Boolean(error)}>
      <Field.Label className="cpm-field-label">{label}</Field.Label>
      {children}
      {hint && <Field.Description className="cpm-field-hint">{hint}</Field.Description>}
      {error && (
        <Field.Error match className="cpm-field-error">
          {error}
        </Field.Error>
      )}
    </Field.Root>
  )
}
export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  disabled,
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: readonly { value: T; label: string }[]
  label: string
  disabled?: boolean
  className?: string
}) {
  return (
    <BaseSelect.Root
      value={value}
      onValueChange={(next) => {
        if (next !== null) onChange(next as T)
      }}
      items={options}
      disabled={disabled}
    >
      <BaseSelect.Trigger aria-label={label} className={cs('cpm-select', className)}>
        <BaseSelect.Value />
        <BaseSelect.Icon className="cpm-select-icon">
          <ChevronDown size={16} />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner sideOffset={6} className="cpm-positioner" alignItemWithTrigger={false}>
          <BaseSelect.Popup className="cpm-popup cpm-select-popup">
            <BaseSelect.List>
              {options.map((option) => (
                <BaseSelect.Item key={option.value} value={option.value} className="cpm-option">
                  <BaseSelect.ItemText>{option.label}</BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator>
                    <Check size={16} />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  )
}
export function Switch({
  checked,
  onChange,
  label,
  ...props
}: { checked: boolean; onChange: (value: boolean) => void; label: string } & Omit<
  ComponentProps<typeof BaseSwitch.Root>,
  'onChange' | 'onCheckedChange' | 'className'
>) {
  return (
    <BaseSwitch.Root {...props} aria-label={label} checked={checked} onCheckedChange={onChange} className="cpm-switch">
      <BaseSwitch.Thumb className="cpm-switch-thumb" />
    </BaseSwitch.Root>
  )
}
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (value: T) => void
  options: readonly { value: T; label: string }[]
  label: string
}) {
  return (
    <RadioGroup
      aria-label={label}
      value={value}
      onValueChange={(next) => onChange(next as T)}
      className="cpm-segmented"
    >
      {options.map((option) => (
        <Radio.Root key={option.value} value={option.value} className="cpm-segment">
          {option.label}
        </Radio.Root>
      ))}
    </RadioGroup>
  )
}
export function SettingRow({
  title,
  description,
  children,
}: {
  title: string
  description: ReactNode
  children: ReactNode
}) {
  const id = useId()
  return (
    <section className="cpm-setting-row" aria-labelledby={id}>
      <div>
        <h3 id={id}>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="cpm-setting-control">{children}</div>
    </section>
  )
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  disabled?: boolean
  className?: string
}) {
  return (
    <label className={cs('cpm-checkbox-label', className)}>
      <BaseCheckbox.Root checked={checked} onCheckedChange={onChange} disabled={disabled} className="cpm-checkbox">
        <BaseCheckbox.Indicator className="cpm-checkbox-indicator">
          <Check size={13} strokeWidth={3} />
        </BaseCheckbox.Indicator>
      </BaseCheckbox.Root>
      <span>{label}</span>
    </label>
  )
}
