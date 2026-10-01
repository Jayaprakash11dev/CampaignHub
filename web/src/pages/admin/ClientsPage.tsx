import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { ApiErrorAlert } from '../../components/ApiErrorAlert'
import { EmptyState, ErrorState } from '../../components/States'
import { useClients, useUsers } from '../../hooks/queries'
import { api } from '../../lib/api'
import type { AdminUser, Client } from '../../lib/types'

export function ClientsPage() {
  const clients = useClients()
  const reviewers = useUsers('REVIEWER')
  const queryClient = useQueryClient()
  const [name, setName] = useState('')

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['clients'] })

  const create = useMutation({
    mutationFn: () => api.post('/clients', { name }),
    onSuccess: async () => {
      setName('')
      await refresh()
    },
  })

  function handleCreate(event: FormEvent) {
    event.preventDefault()
    create.mutate()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Clients</h1>

      <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Add client</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <input
            aria-label="Client name"
            required
            placeholder="Brand name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {create.isPending ? 'Adding…' : 'Add client'}
          </button>
        </div>
        {create.isError && (
          <div className="mt-3">
            <ApiErrorAlert error={create.error} />
          </div>
        )}
      </form>

      {clients.isPending ? (
        <div className="h-48 animate-pulse rounded-xl bg-slate-200" />
      ) : clients.isError ? (
        <ErrorState error={clients.error} onRetry={() => void clients.refetch()} />
      ) : clients.data.length === 0 ? (
        <EmptyState title="No clients yet">Add the first client brand above.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clients.data.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              allReviewers={reviewers.data ?? []}
              onChanged={refresh}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ClientCard({
  client,
  allReviewers,
  onChanged,
}: {
  client: Client
  allReviewers: AdminUser[]
  onChanged: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState<number[]>([])

  const saveReviewers = useMutation({
    // Sends the full list; the API replaces the current assignment with it.
    mutationFn: () => api.put(`/clients/${client.id}/reviewers`, { reviewerIds: selected }),
    onSuccess: async () => {
      setEditing(false)
      await onChanged()
    },
  })

  const remove = useMutation({
    mutationFn: () => api.delete(`/clients/${client.id}`),
    onSuccess: onChanged,
  })

  function startEditing() {
    setSelected(client.reviewers.map((r) => r.id))
    saveReviewers.reset()
    setEditing(true)
  }

  function toggle(id: number) {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    )
  }

  const hasPosts = client._count.posts > 0

  return (
    <article
      aria-label={client.name}
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-4"
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{client.name}</h2>
          <p className="text-xs text-slate-500">
            {client._count.posts} {client._count.posts === 1 ? 'post' : 'posts'}
          </p>
        </div>
        <button
          type="button"
          disabled={hasPosts || remove.isPending}
          title={hasPosts ? 'Clients with posts cannot be deleted' : undefined}
          onClick={() => {
            if (window.confirm(`Delete ${client.name}?`)) remove.mutate()
          }}
          className="text-sm font-medium text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline"
        >
          Delete
        </button>
      </header>

      <div className="mt-3 flex-1">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Reviewers</p>
        {editing ? (
          <fieldset className="mt-2 space-y-1">
            <legend className="sr-only">Reviewers for {client.name}</legend>
            {allReviewers.length === 0 && (
              <p className="text-sm text-slate-500">No users have the reviewer role yet.</p>
            )}
            {allReviewers.map((reviewer) => (
              <label key={reviewer.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(reviewer.id)}
                  onChange={() => toggle(reviewer.id)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                {reviewer.name}
                <span className="text-xs text-slate-400">{reviewer.email}</span>
              </label>
            ))}
          </fieldset>
        ) : client.reviewers.length === 0 ? (
          <p className="mt-2 text-sm text-amber-700">
            No reviewers assigned. Posts for this client can't be approved yet.
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {client.reviewers.map((reviewer) => (
              <li
                key={reviewer.id}
                className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800"
              >
                {reviewer.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {(saveReviewers.isError || remove.isError) && (
        <div className="mt-3">
          <ApiErrorAlert error={saveReviewers.error ?? remove.error} />
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {editing ? (
          <>
            <button
              type="button"
              onClick={() => saveReviewers.mutate()}
              disabled={saveReviewers.isPending}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saveReviewers.isPending ? 'Saving…' : 'Save reviewers'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit reviewers
          </button>
        )}
      </div>
    </article>
  )
}
