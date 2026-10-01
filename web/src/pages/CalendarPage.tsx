import { Link, useSearchParams } from 'react-router'
import { PlatformBadge, StatusBadge } from '../components/Badges'
import { EmptyState, ErrorState } from '../components/States'
import { useClients, usePosts } from '../hooks/queries'
import {
  addDays,
  dayjs,
  formatIst,
  istDate,
  istDayStartUtc,
  istToday,
  istWeekStart,
} from '../lib/datetime'
import type { Post } from '../lib/types'

// Week view of one client's posts. Times and day boundaries are IST.
export function CalendarPage() {
  const clients = useClients()
  // Client, week and the "in progress" toggle live in the URL, like the
  // board filters.
  const [searchParams, setSearchParams] = useSearchParams()
  // No client in the URL yet: default to the first one the user can see.
  const clientId =
    Number(searchParams.get('client')) || clients.data?.[0]?.id || undefined
  const week = searchParams.get('week') ?? istWeekStart()
  const showInProgress = searchParams.get('all') === '1'

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    setSearchParams(next, { replace: true })
  }

  // Wait for the client before loading, otherwise we'd briefly fetch
  // every client's posts.
  const posts = usePosts(
    {
      clientId,
      from: istDayStartUtc(week),
      to: istDayStartUtc(addDays(week, 7)),
    },
    { enabled: clientId !== undefined },
  )

  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i))
  const today = istToday()
  const client = clients.data?.find((c) => c.id === clientId)

  // The brief asks for scheduled posts; published ones are kept so the
  // week still makes sense after posts go live.
  const visible = (posts.data ?? []).filter(
    (p) => showInProgress || p.status === 'SCHEDULED' || p.status === 'PUBLISHED',
  )
  const byDay = new Map<string, Post[]>(days.map((d) => [d, []]))
  for (const post of visible) {
    byDay.get(istDate(post.scheduledAt))?.push(post)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Calendar</h1>
          <p className="text-sm text-slate-500" data-testid="week-label">
            {dayjs(week).format('D MMM')} – {dayjs(addDays(week, 6)).format('D MMM YYYY')} (IST)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Client"
            value={clientId ?? ''}
            onChange={(e) => update({ client: e.target.value })}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            {clients.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="flex overflow-hidden rounded-md border border-slate-300 bg-white text-sm">
            <button
              type="button"
              onClick={() => update({ week: addDays(week, -7) })}
              className="px-3 py-1.5 hover:bg-slate-50"
            >
              ← Previous
            </button>
            <button
              type="button"
              onClick={() => update({ week: null })}
              className="border-x border-slate-300 px-3 py-1.5 hover:bg-slate-50"
            >
              This week
            </button>
            <button
              type="button"
              onClick={() => update({ week: addDays(week, 7) })}
              className="px-3 py-1.5 hover:bg-slate-50"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={showInProgress}
          onChange={(e) => update({ all: e.target.checked ? '1' : null })}
          className="h-4 w-4 rounded border-slate-300"
        />
        Also show posts still in progress (draft, in review, approved)
      </label>

      <div className="mt-4">
        {clients.isError ? (
          <ErrorState error={clients.error} onRetry={() => void clients.refetch()} />
        ) : clients.data && clients.data.length === 0 ? (
          <EmptyState title="No clients to show">
            You aren't assigned to any clients yet.
          </EmptyState>
        ) : posts.isError ? (
          <ErrorState error={posts.error} onRetry={() => void posts.refetch()} />
        ) : posts.isPending || !clientId ? (
          <div className="grid gap-3 lg:grid-cols-7" aria-label="Loading calendar">
            {days.map((d) => (
              <div key={d} className="h-40 animate-pulse rounded-xl bg-slate-200" />
            ))}
          </div>
        ) : (
          <>
            {visible.length === 0 && (
              <p className="mb-3 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
                Nothing scheduled for {client?.name ?? 'this client'} this week.
              </p>
            )}
            <div className="grid gap-3 lg:grid-cols-7">
              {days.map((day) => (
                <DayColumn key={day} day={day} isToday={day === today} posts={byDay.get(day) ?? []} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function DayColumn({ day, isToday, posts }: { day: string; isToday: boolean; posts: Post[] }) {
  return (
    <section
      aria-label={day}
      className={`min-w-0 rounded-xl border p-2 ${
        isToday ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200 bg-white'
      }`}
    >
      <h2 className="mb-2 flex items-baseline gap-1 px-1 text-sm">
        <span className="font-semibold">{dayjs(day).format('ddd')}</span>
        <span className="text-slate-500">{dayjs(day).format('D MMM')}</span>
        {isToday && <span className="ml-auto text-xs font-medium text-indigo-600">Today</span>}
      </h2>
      {posts.length === 0 ? (
        <p className="px-1 pb-1 text-sm text-slate-300">—</p>
      ) : (
        <ul className="space-y-2">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                to={`/posts/${post.id}`}
                className="block rounded-lg border border-slate-200 bg-white p-2 hover:border-indigo-300"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-slate-700">
                    {formatIst(post.scheduledAt, 'h:mm A')}
                  </span>
                  <PlatformBadge platform={post.platform} />
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-600">{post.caption}</p>
                {post.status !== 'SCHEDULED' && (
                  <div className="mt-1">
                    <StatusBadge status={post.status} />
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
