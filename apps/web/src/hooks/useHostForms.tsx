import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { PS4Host, FileServerHost } from '@/types'

type HostForm = { type: 'ps4'; host?: PS4Host } | { type: 'server'; host?: FileServerHost }
const HostFormsContext = createContext<{
  form?: HostForm
  openPS4Host: (host?: PS4Host) => void
  openFileServer: (host?: FileServerHost) => void
  close: () => void
} | null>(null)

export function HostFormsProvider({ children }: { children: ReactNode }) {
  const [form, setForm] = useState<HostForm>()
  const openPS4Host = useCallback((host?: PS4Host) => setForm({ type: 'ps4', host }), [])
  const openFileServer = useCallback((host?: FileServerHost) => setForm({ type: 'server', host }), [])
  const close = useCallback(() => setForm(undefined), [])
  return (
    <HostFormsContext.Provider value={{ form, openPS4Host, openFileServer, close }}>
      {children}
    </HostFormsContext.Provider>
  )
}

function useHostForms() {
  const context = useContext(HostFormsContext)
  if (!context) throw new Error('Host forms require HostFormsProvider')
  return context
}

export function usePS4HostForm() {
  const { form, openPS4Host, close } = useHostForms()
  return { visible: form?.type === 'ps4', host: form?.type === 'ps4' ? form.host : undefined, open: openPS4Host, close }
}

export function useFileServerForm() {
  const { form, openFileServer, close } = useHostForms()
  return {
    visible: form?.type === 'server',
    host: form?.type === 'server' ? form.host : undefined,
    open: openFileServer,
    close,
  }
}
