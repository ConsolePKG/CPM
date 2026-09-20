import { SegmentedControl, useTheme } from '@/design-system'
export const ToggleDarkMode = () => {
  const { mode, setMode } = useTheme()
  return (
    <SegmentedControl
      value={mode}
      onChange={setMode}
      label="外观"
      options={[
        { value: 'light', label: '日间' },
        { value: 'dark', label: '夜间' },
        { value: 'system', label: '跟随系统' },
      ]}
    />
  )
}
