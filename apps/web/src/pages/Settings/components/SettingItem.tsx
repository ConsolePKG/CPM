import { SettingRow } from '@/design-system'
import type { ReactNode } from 'react'
export const SettingItem = ({ title, desc, children }: { title: string; desc: string; children: ReactNode }) => (
  <SettingRow title={title} description={desc}>
    {children}
  </SettingRow>
)
