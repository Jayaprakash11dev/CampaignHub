import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import { clearAuth, readAuth, writeAuth } from '../lib/auth-storage'
import type { User } from '../lib/types'
import { AuthContext, type AuthContextValue } from './auth-context'

interface LoginResponse {
  accessToken: string
  user: User
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(() => readAuth()?.user ?? null)
  const [checking, setChecking] = useState(() => readAuth() !== null)

  // On load, check the stored token is still valid and refresh the user
  // (their role may have changed). An expired token gets a 401, which the
  // axios interceptor turns into a redirect to /login.
  useEffect(() => {
    const stored = readAuth()
    if (!stored) return

    api
      .get<User>('/auth/me')
      .then(({ data }) => {
        writeAuth({ token: stored.token, user: data })
        setUser(data)
      })
      .catch(() => {
        // Network errors keep the stored user; 401 is handled globally.
      })
      .finally(() => setChecking(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<LoginResponse>('/auth/login', {
      email,
      password,
    })
    writeAuth({ token: data.accessToken, user: data.user })
    setUser(data.user)
    return data.user
  }, [])

  // A full page load instead of setUser(null) + navigate(): it guarantees
  // nothing from this user survives in memory (cached posts, form state),
  // and the next person to log in starts on the board, not on whatever page
  // the previous user had open.
  const logout = useCallback(() => {
    clearAuth()
    queryClient.clear()
    window.location.assign('/login')
  }, [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({ user, checking, login, logout }),
    [user, checking, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
