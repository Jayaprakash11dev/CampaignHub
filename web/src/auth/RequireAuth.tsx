import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import type { Role } from '../lib/types'
import { useAuth } from './useAuth'

interface Props {
  children: ReactNode
  // Leave out to allow any logged-in user.
  roles?: Role[]
}

// Guards a route in the UI. The API enforces the same rules, so this is
// about showing the right screen, not about security.
export function RequireAuth({ children, roles }: Props) {
  const { user, checking } = useAuth()
  const location = useLocation()

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-stone-500">
        Loading…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-lg border border-stone-200 bg-white p-6 text-center">
        <h1 className="text-lg font-semibold">No access</h1>
        <p className="mt-2 text-sm text-stone-600">
          You don't have access to this page with the {user.role.toLowerCase()} role.
        </p>
      </div>
    )
  }

  return children
}
