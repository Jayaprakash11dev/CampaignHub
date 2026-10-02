import { Link } from 'react-router'
import { dayjs, formatIst, istDate } from '../../lib/datetime'
import { PLATFORM_LABEL, STATUS_DOT } from '../../lib/labels'
import type { Post } from '../../lib/types'
import { Avatar } from '../Avatar'
import { StatusBadge } from '../Badges'
import { PlatformIcon } from '../PlatformIcon'

// The calendar on small screens: one card per day, posts listed by time.
export function AgendaList({ days, today, posts }: { days: string[]; today: string; posts: Post[] }) {
  const byDay = new Map<string, Post[]>(days.map((d) => [d, []]))
  for (const post of posts) byDay.get(istDate(post.scheduledAt))?.push(post)

  return (
    <div className="space-y-3">
      {days.map((day) => {
        const dayPosts = byDay.get(day) ?? []
        const isToday = day === today
        return (
          <section
            key={day}
            aria-label={day}
            aria-current={isToday ? 'date' : undefined}
            className={`rounded-2xl border bg-white p-3 ${isToday ? 'border-brand-300' : 'border-stone-200'}`}
          >
            <h2 className="flex items-center gap-2 px-1 text-sm">
              <span className="font-semibold text-stone-900">{dayjs(day).format('ddd, D MMM')}</span>
              {isToday && (
                <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">Today</span>
              )}
              {dayPosts.length === 0 && <span className="ml-auto text-xs text-stone-400">No posts</span>}
            </h2>

            {dayPosts.length > 0 && (
              <ul className="mt-2 divide-y divide-stone-100">
                {dayPosts.map((post) => (
                  <li key={post.id}>
                    <Link to={`/posts/${post.id}`} className="flex gap-3 rounded-lg px-1 py-2.5 hover:bg-stone-50">
                      <div className="w-14 shrink-0 text-center">
                        <div className="text-lg leading-none font-semibold text-stone-900">
                          {formatIst(post.scheduledAt, 'h:mm')}
                        </div>
                        <div className="mt-0.5 text-[10px] font-semibold tracking-wider text-stone-500">
                          {formatIst(post.scheduledAt, 'A')}
                        </div>
                      </div>
                      <span aria-hidden className={`w-[3px] shrink-0 rounded-full ${STATUS_DOT[post.status]}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Avatar name={post.client.name} size="xs" single />
                          <span className="truncate text-sm font-medium text-stone-900">{post.client.name}</span>
                          <span title={PLATFORM_LABEL[post.platform]} className="ml-auto text-stone-700">
                            <PlatformIcon platform={post.platform} />
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-stone-600">{post.caption}</p>
                        {post.status !== 'SCHEDULED' && (
                          <div className="mt-1.5">
                            <StatusBadge status={post.status} />
                          </div>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
