import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/useAuth'
import { ApiErrorAlert } from '../../components/ApiErrorAlert'
import { ErrorState } from '../../components/States'
import { useUsers } from '../../hooks/queries'
import { api } from '../../lib/api'
import { formatIst } from '../../lib/datetime'
import type { AdminUser, Role } from '../../lib/types'

const ROLES: Role[] = ['ADMIN', 'CREATOR', 'REVIEWER']
const inputClass = 'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm'

export function UsersPage() {
  const { user: me } = useAuth()
  const users = useUsers()
  const queryClient = useQueryClient()

  // Changing a role can also remove reviewer assignments on the API side,
  // so refresh clients too.
  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['users'] }),
      queryClient.invalidateQueries({ queryKey: ['clients'] }),
    ])
  }

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: number; role: Role }) =>
      api.patch(`/users/${id}`, { role }),
    onSuccess: refresh,
  })

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: refresh,
  })

  function handleDelete(user: AdminUser) {
    if (window.confirm(`Delete ${user.name}? This cannot be undone.`)) {
      changeRole.reset()
      remove.mutate(user.id)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Users</h1>

      <AddUserForm onCreated={refresh} />

      {(changeRole.isError || remove.isError) && (
        <ApiErrorAlert error={changeRole.error ?? remove.error} />
      )}

      {users.isPending ? (
        <div className="h-48 animate-pulse rounded-xl bg-slate-200" />
      ) : users.isError ? (
        <ErrorState error={users.error} onRetry={() => void users.refetch()} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.data.map((user) => {
                const isMe = user.id === me?.id
                return (
                  <tr key={user.id}>
                    <td className="px-4 py-3 font-medium">
                      {user.name}
                      {isMe && (
                        <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-700">
                          You
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{user.email}</td>
                    <td className="px-4 py-3">
                      {/* The API won't let admins change their own role, so
                          they can't lock themselves out. */}
                      <select
                        aria-label={`Role for ${user.name}`}
                        value={user.role}
                        disabled={isMe || changeRole.isPending}
                        onChange={(e) => {
                          remove.reset()
                          changeRole.mutate({ id: user.id, role: e.target.value as Role })
                        }}
                        className={`${inputClass} py-1 disabled:bg-slate-100`}
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role.charAt(0) + role.slice(1).toLowerCase()}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatIst(user.createdAt, 'D MMM YYYY')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isMe && (
                        <button
                          type="button"
                          onClick={() => handleDelete(user)}
                          disabled={remove.isPending}
                          className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500">
        Users who have written posts or comments can't be deleted; change their role instead.
      </p>
    </div>
  )
}

function AddUserForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('CREATOR')

  const create = useMutation({
    mutationFn: () => api.post('/users', { name, email, password, role }),
    onSuccess: async () => {
      setName('')
      setEmail('')
      setPassword('')
      await onCreated()
    },
  })

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    create.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-700">Add user</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input
          aria-label="Name"
          required
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        <input
          aria-label="Email"
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <input
          aria-label="Password"
          type="password"
          required
          minLength={8}
          placeholder="Password (8+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        <select
          aria-label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className={inputClass}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.charAt(0) + r.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {create.isPending ? 'Adding…' : 'Add user'}
        </button>
      </div>
      {create.isError && (
        <div className="mt-3">
          <ApiErrorAlert error={create.error} />
        </div>
      )}
    </form>
  )
}
