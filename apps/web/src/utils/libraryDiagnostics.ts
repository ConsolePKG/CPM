export type LibraryDiagnostics = {
  updatedAt: number
  hostType?: string
  listingState?: 'loading' | 'complete' | 'error'
  listingMs?: number
  fileCount?: number
  readerMode?: 'waiting' | 'worker-started' | 'worker' | 'worker-error' | 'main' | 'server' | 'not-needed'
  readerReason?: string
  navigationTo?: string
  navigationMs?: number
  navigationInputMs?: number
  navigationInputType?: string
  tasksNavigationMs?: number
  settingsNavigationMs?: number
}

const key = 'cpm-library-diagnostics'

export function recordLibraryDiagnostics(update: Partial<LibraryDiagnostics>) {
  try {
    const previous = JSON.parse(localStorage.getItem(key) || '{}') as LibraryDiagnostics
    localStorage.setItem(key, JSON.stringify({ ...previous, ...update, updatedAt: Date.now() }))
  } catch {
    // Diagnostics must never interfere with library loading.
  }
}
