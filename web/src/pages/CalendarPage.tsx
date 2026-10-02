import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { AgendaList } from '../components/calendar/AgendaList'
import { WeekGrid } from '../components/calendar/WeekGrid'
import { EmptyState, ErrorState } from '../components/States'
import { useClients, usePosts } from '../hooks/queries'
import { useMediaQuery } from '../hooks/useMediaQuery'
import {
  addDays,
  dayjs,
  istDayStartUtc,
  istMinutesOfDay,
  istToday,
  istWeekStart,
  mondayOf,
} from '../lib/datetime'
import { STATUS_DOT, STATUS_LABEL } from '../lib/labels'
import { isIsoDate } from '../lib/params'

// Week view of one client's posts. Times and day boundaries are IST.
export function CalendarPage() {
  const clients = useClients()
  // Client, week and the "in progress" toggle live in the URL, like the
  // board filters.
  const [searchParams, setSearchParams] = useSearchParams()
  // No client in the URL yet: default to the first one the user can see.
  const clientId =
    Number(searchParams.get('client')) || clients.data?.[0]?.id || undefined
  // The URL can be edited by hand: ignore anything that isn't a real date,
  // and snap any day to the Monday of its week.
  const weekParam = searchParams.get('week')
  const week = isIsoDate(weekParam) ? mondayOf(weekParam) : istWeekStart()
  const showInProgress = searchParams.get('all') === '1'
  const isThisWeek = week === istWeekStart()

  // Desktop gets the time grid, phones get a list. Only one is rendered.
  const isWide = useMediaQuery('(min-width: 1024px)')
  const nowMinutes = useNowMinutes()

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

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="mt-1 text-sm text-stone-500" data-testid="week-label">
            {dayjs(week).format('D MMM')} – {dayjs(addDays(week, 6)).format('D MMM YYYY')}
            <span className="text-stone-400"> · IST</span>
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <select
            aria-label="Client"
            value={clientId ?? ''}
            onChange={(e) => update({ client: e.target.value })}
            className="min-w-0 flex-1 rounded-full border border-stone-200 bg-white py-1.5 pr-8 pl-3.5 text-sm font-medium text-stone-800 shadow-xs hover:border-stone-300 sm:w-56 sm:flex-none"
          >
            {clients.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="flex items-center rounded-full border border-stone-200 bg-white p-0.5 shadow-xs">
            <button
              type="button"
              aria-label="Previous week"
              title="Previous week"
              onClick={() => update({ week: addDays(week, -7) })}
              className="rounded-full p-1.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            >
              <ChevronLeft aria-hidden className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => update({ week: null })}
              disabled={isThisWeek}
              className="rounded-full px-3 py-1 text-sm font-medium text-stone-800 hover:bg-stone-100 disabled:cursor-default disabled:text-stone-400 disabled:hover:bg-transparent"
            >
              Today
            </button>
            <button
              type="button"
              aria-label="Next week"
              title="Next week"
              onClick={() => update({ week: addDays(week, 7) })}
              className="rounded-full p-1.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            >
              <ChevronRight aria-hidden className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-stone-700">
          <input
            type="checkbox"
            role="switch"
            checked={showInProgress}
            onChange={(e) => update({ all: e.target.checked ? '1' : null })}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="relative h-5 w-9 rounded-full bg-stone-300 transition-colors peer-checked:bg-brand-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500 after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-4"
          />
          Include posts in progress
        </label>

        <Legend showInProgress={showInProgress} />
      </div>

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
          <div className="h-120 animate-pulse rounded-2xl bg-stone-200/70" aria-label="Loading calendar" />
        ) : (
          <>
            {visible.length === 0 && (
              <p className="mb-3 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-600">
                Nothing scheduled for {client?.name ?? 'this client'} this week.
              </p>
            )}
            {isWide ? (
              <WeekGrid days={days} today={today} posts={visible} nowMinutes={nowMinutes} />
            ) : (
              <AgendaList days={days} today={today} posts={visible} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Legend({ showInProgress }: { showInProgress: boolean }) {
  const statuses = showInProgress
    ? (['DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'SCHEDULED', 'PUBLISHED'] as const)
    : (['SCHEDULED', 'PUBLISHED'] as const)
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
      {statuses.map((status) => (
        <li key={status} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
          {STATUS_LABEL[status]}
        </li>
      ))}
    </ul>
  )
}

// The current IST minute, refreshed every 30 seconds for the "now" line.
function useNowMinutes() {
  const [minutes, setMinutes] = useState(() => istMinutesOfDay())
  useEffect(() => {
    const timer = setInterval(() => setMinutes(istMinutesOfDay()), 30_000)
    return () => clearInterval(timer)
  }, [])
  return minutes
}
