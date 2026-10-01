import { Link } from 'react-router'
import { formatIst } from '../lib/datetime'
import type { Post } from '../lib/types'
import { PlatformBadge } from './Badges'

export function PostCard({ post, isMine }: { post: Post; isMine: boolean }) {
  return (
    <Link
      to={`/posts/${post.id}`}
      className="block rounded-lg border border-slate-200 bg-white p-3 shadow-xs transition hover:border-indigo-300 hover:shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <PlatformBadge platform={post.platform} />
        <span className="text-xs text-slate-400">#{post.id}</span>
      </div>

      <p className="mt-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {post.client.name}
      </p>
      <p className="mt-1 line-clamp-3 text-sm text-slate-800">{post.caption}</p>

      {/* Two lines rather than one: board columns can be narrow. */}
      <div className="mt-3 space-y-0.5 text-xs text-slate-500">
        <p title="Scheduled time (IST)" className="whitespace-nowrap">
          🕒 {formatIst(post.scheduledAt, 'D MMM, h:mm A')} IST
        </p>
        <p className="truncate">
          by{' '}
          {isMine ? (
            <span className="font-medium text-indigo-600">you</span>
          ) : (
            post.createdBy.name
          )}
        </p>
      </div>
    </Link>
  )
}
