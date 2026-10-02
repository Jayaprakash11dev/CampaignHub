import { Link } from 'react-router'
import { dayjs, formatIst, istDate, istMinutesOfDay } from '../../lib/datetime'
import { PLATFORM_LABEL, STATUS_DOT, STATUS_LABEL, STATUS_TINT } from '../../lib/labels'
import type { Post } from '../../lib/types'
import { PlatformIcon } from '../PlatformIcon'

// Height of one hour on the grid, and how tall a post block is drawn.
// Posts are a moment in time, so the 45 minutes is only for readability.
const HOUR_PX = 56
const BLOCK_MINUTES = 45

interface Placed {
  post: Post
  minutes: number
  lane: number
  lanes: number
}

// Posts that would overlap on screen are put side by side: sort by time,
// give each one the first free "lane", and size every post in an
// overlapping group by the number of lanes that group needs.
function placeDay(posts: Post[]): Placed[] {
  const sorted = posts
    .map((post) => ({ post, minutes: istMinutesOfDay(post.scheduledAt) }))
    .sort((a, b) => a.minutes - b.minutes)

  const placed: Placed[] = []
  let group: Placed[] = []
  let laneEnds: number[] = []
  let groupEnd = -1

  const closeGroup = () => {
    for (const item of group) item.lanes = laneEnds.length
    group = []
    laneEnds = []
  }

  for (const { post, minutes } of sorted) {
    if (minutes >= groupEnd) closeGroup()
    let lane = laneEnds.findIndex((end) => end <= minutes)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(0)
    }
    laneEnds[lane] = minutes + BLOCK_MINUTES
    groupEnd = Math.max(groupEnd, minutes + BLOCK_MINUTES)
    const item = { post, minutes, lane, lanes: 1 }
    group.push(item)
    placed.push(item)
  }
  closeGroup()
  return placed
}

function hourLabel(hour: number) {
  return dayjs().hour(hour).minute(0).format('h A')
}

export function WeekGrid({
  days,
  today,
  posts,
  nowMinutes,
}: {
  days: string[]
  today: string
  posts: Post[]
  nowMinutes: number
}) {
  // 6 AM to 11 PM, stretched if a post falls outside that.
  const allMinutes = posts.map((p) => istMinutesOfDay(p.scheduledAt))
  const startHour = Math.min(6, ...allMinutes.map((m) => Math.floor(m / 60)))
  const endHour = Math.min(24, Math.max(23, ...allMinutes.map((m) => Math.ceil((m + BLOCK_MINUTES) / 60))))
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)
  const height = hours.length * HOUR_PX
  const toPx = (minutes: number) => ((minutes - startHour * 60) / 60) * HOUR_PX

  const byDay = new Map<string, Post[]>(days.map((d) => [d, []]))
  for (const post of posts) byDay.get(istDate(post.scheduledAt))?.push(post)

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
      {/* Day headers */}
      <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-stone-200">
        <div />
        {days.map((day) => {
          const isToday = day === today
          return (
            <div key={day} className="border-l border-stone-100 py-3 text-center">
              <div className={`text-[11px] font-semibold tracking-wider uppercase ${isToday ? 'text-brand-700' : 'text-stone-500'}`}>
                {dayjs(day).format('ddd')}
              </div>
              <div
                className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-base font-semibold ${
                  isToday ? 'bg-brand-600 text-white' : 'text-stone-900'
                }`}
              >
                {dayjs(day).format('D')}
              </div>
            </div>
          )
        })}
      </div>

      {/* Time grid */}
      <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
        <div className="relative" style={{ height }} aria-hidden>
          {hours.map((hour) =>
            hour === startHour ? null : (
              <span
                key={hour}
                data-hour={hour}
                className="absolute right-2 -translate-y-1/2 text-[10px] font-medium whitespace-nowrap text-stone-400"
                style={{ top: (hour - startHour) * HOUR_PX }}
              >
                {hourLabel(hour)}
              </span>
            ),
          )}
        </div>

        {days.map((day) => {
          const isToday = day === today
          return (
            <section
              key={day}
              aria-label={day}
              aria-current={isToday ? 'date' : undefined}
              className={`relative border-l border-stone-100 ${isToday ? 'bg-brand-50/40' : ''}`}
              style={{
                height,
                backgroundImage: 'linear-gradient(to bottom, var(--color-stone-100) 1px, transparent 1px)',
                backgroundSize: `100% ${HOUR_PX}px`,
              }}
            >
              {placeDay(byDay.get(day) ?? []).map(({ post, minutes, lane, lanes }) => (
                <Link
                  key={post.id}
                  to={`/posts/${post.id}`}
                  title={post.caption}
                  aria-label={`${formatIst(post.scheduledAt, 'h:mm A')} ${PLATFORM_LABEL[post.platform]} post for ${post.client.name}, ${STATUS_LABEL[post.status]}`}
                  data-minutes={minutes}
                  className={`absolute overflow-hidden rounded-lg border border-stone-200/80 py-1 pr-1.5 pl-2.5 text-left shadow-xs transition-shadow hover:z-10 hover:shadow-md ${STATUS_TINT[post.status]}`}
                  style={{
                    top: toPx(minutes) + 1,
                    height: (BLOCK_MINUTES / 60) * HOUR_PX - 2,
                    left: `calc(${(lane / lanes) * 100}% + 2px)`,
                    width: `calc(${100 / lanes}% - 4px)`,
                  }}
                >
                  <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] ${STATUS_DOT[post.status]}`} />
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-stone-900">
                    <PlatformIcon platform={post.platform} className="h-3 w-3 shrink-0" />
                    <span className="truncate">{formatIst(post.scheduledAt, 'h:mm A')}</span>
                  </span>
                  <span className="block truncate text-[11px] text-stone-600">{post.client.name}</span>
                </Link>
              ))}

              {isToday && nowMinutes >= startHour * 60 && nowMinutes < endHour * 60 && (
                <div
                  aria-hidden
                  data-testid="now-line"
                  className="pointer-events-none absolute right-0 left-0 z-20 border-t-2 border-brand-600"
                  style={{ top: toPx(nowMinutes) }}
                >
                  <span className="absolute -top-[5px] -left-[5px] h-2 w-2 rounded-full bg-brand-600" />
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
