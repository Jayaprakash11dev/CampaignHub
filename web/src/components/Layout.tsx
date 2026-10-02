import { LogOut } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth'
import type { Role } from '../lib/types'
import { Avatar } from './Avatar'
import { ErrorBoundary } from './ErrorBoundary'

interface NavItem {
  to: string
  label: string
  // Roles that see this link. The API enforces the same rules.
  roles: Role[]
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Board', roles: ['ADMIN', 'CREATOR', 'REVIEWER'] },
  { to: '/calendar', label: 'Calendar', roles: ['ADMIN', 'CREATOR', 'REVIEWER'] },
  { to: '/posts/new', label: 'New post', roles: ['CREATOR'] },
  { to: '/admin/users', label: 'Users', roles: ['ADMIN'] },
  { to: '/admin/clients', label: 'Clients', roles: ['ADMIN'] },
]

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: 'bg-fuchsia-100 text-fuchsia-800',
  CREATOR: 'bg-brand-100 text-brand-800',
  REVIEWER: 'bg-amber-100 text-amber-800',
}

export function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()

  if (!user) return null
  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role))

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2.5 font-semibold tracking-tight text-stone-900">
            <img src="/favicon.svg" alt="" className="h-8 w-8" />
            CampaignHub
          </NavLink>

          <nav className="order-last flex w-full gap-1 overflow-x-auto sm:order-0 sm:w-auto">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-stone-900 text-white'
                      : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={user.name} size="md" />
              <div className="leading-tight">
                <div className="text-sm font-medium">{user.name}</div>
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${ROLE_BADGE[user.role]}`}
                >
                  {user.role}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Log out"
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 px-3 py-1.5 text-sm text-stone-600 transition-colors hover:border-stone-300 hover:bg-stone-100 hover:text-stone-900"
            >
              <LogOut aria-hidden className="h-4 w-4" />
              <span className="hidden sm:inline">Log out</span>
              <span className="sr-only sm:hidden">Log out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl px-4 py-8">
        {/* Keyed by path: a crash on one page clears when you navigate away,
            and the top bar keeps working. */}
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  )
}
