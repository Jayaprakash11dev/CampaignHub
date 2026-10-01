import { createContext } from 'react'
import type { User } from '../lib/types'

export interface AuthContextValue {
  user: User | null
  // true while a stored token is being checked against the API on load
  checking: boolean
  login: (email: string, password: string) => Promise<User>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
