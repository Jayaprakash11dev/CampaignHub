import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/useAuth'
import type { Role } from '../lib/types'

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
  ADMIN: 'bg-purple-100 text-purple-800',
  CREATOR: 'bg-sky-100 text-sky-800',
  REVIEWER: 'bg-amber-100 text-amber-800',
}

export function Layout() {
  const { user, logout } = useAuth()

  if (!user) return null
  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role))

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 font-semibold text-slate-900">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            CampaignHub
          </NavLink>

          <nav className="order-last flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-medium">{user.name}</div>
              <span
                className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${ROLE_BADGE[user.role]}`}
              >
                {user.role}
              </span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
