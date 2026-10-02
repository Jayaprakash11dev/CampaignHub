import { Clock } from 'lucide-react'
import { Link } from 'react-router'
import { formatIst } from '../lib/datetime'
import { PLATFORM_LABEL } from '../lib/labels'
import type { Post } from '../lib/types'
import { Avatar } from './Avatar'
import { PlatformIcon } from './PlatformIcon'

export function PostCard({ post, isMine }: { post: Post; isMine: boolean }) {
  return (
    <Link
      to={`/posts/${post.id}`}
      className="group relative block rounded-xl border border-stone-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(28,25,23,0.04)] transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
    >
      <div className="flex items-center gap-2.5">
        <Avatar name={post.client.name} size="md" single />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-stone-900">{post.client.name}</p>
          <p className="flex items-center gap-1 text-[11px] font-medium text-stone-500">
            <PlatformIcon platform={post.platform} className="h-3 w-3 text-stone-800" />
            {PLATFORM_LABEL[post.platform]}
          </p>
        </div>
      </div>

      <p className="mt-2.5 line-clamp-3 text-[13px] leading-relaxed text-stone-600">
        {post.caption}
      </p>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-stone-100 pt-2.5">
        <span
          title="Scheduled time (IST)"
          className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-stone-700"
        >
          <Clock aria-hidden className="h-3 w-3" />
          {formatIst(post.scheduledAt, 'D MMM, h:mm A')} IST
        </span>
        {/* Author as an avatar only: the card is too narrow for a name next
            to the time. The ring marks your own posts. */}
        <span
          title={isMine ? 'Created by you' : `Created by ${post.createdBy.name}`}
          className={`flex shrink-0 rounded-full ${isMine ? 'ring-2 ring-brand-300 ring-offset-1' : ''}`}
        >
          <Avatar name={post.createdBy.name} size="xs" />
          <span className="sr-only">{isMine ? 'you' : post.createdBy.name}</span>
        </span>
      </div>
    </Link>
  )
}
