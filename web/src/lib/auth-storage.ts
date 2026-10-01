import type { User } from './types'

// The JWT and the logged-in user are kept in localStorage so a page
// refresh doesn't log the user out. Access is wrapped in try/catch because
// storage can be unavailable (private mode, blocked site data).

const KEY = 'campaignhub.auth'

export interface StoredAuth {
  token: string
  user: User
}

export function readAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as StoredAuth) : null
  } catch {
    return null
  }
}

export function writeAuth(auth: StoredAuth): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(auth))
  } catch {
    // Still logged in for this tab; just won't survive a refresh.
  }
}

export function clearAuth(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
