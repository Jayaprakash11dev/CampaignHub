import { Link, useParams } from 'react-router'
import { AuditTimeline } from '../components/AuditTimeline'
import { PlatformBadge, StatusBadge } from '../components/Badges'
import { CommentThread } from '../components/CommentThread'
import { PostActions } from '../components/PostActions'
import { PostPreview } from '../components/PostPreview'
import { EmptyState, ErrorState } from '../components/States'
import { usePost } from '../hooks/queries'
import { getApiError } from '../lib/api-error'
import { formatIst, isInPast } from '../lib/datetime'
import { parseId } from '../lib/params'
import type { PostStatus } from '../lib/types'

export function PostDetailPage() {
  // undefined for ids like "abc", which then show the not-found message
  const postId = parseId(useParams().id)
  const post = usePost(postId)

  if (postId === undefined) {
    return <PostNotFound />
  }

  if (post.isPending) {
    return (
      <div className="space-y-4" aria-label="Loading post">
        <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
        <div className="h-64 animate-pulse rounded-xl bg-slate-200" />
      </div>
    )
  }

  if (post.isError) {
    // Same 404 for "doesn't exist" and "not one of your clients": the API
    // doesn't reveal which, so neither do we.
    if (getApiError(post.error).code === 'NOT_FOUND') {
      return <PostNotFound />
    }
    return <ErrorState error={post.error} onRetry={() => void post.refetch()} />
  }

  const p = post.data
  const timePassed =
    p.status !== 'SCHEDULED' && p.status !== 'PUBLISHED' && isInPast(p.scheduledAt)

  return (
    <div>
      <Link to="/" className="text-sm text-slate-500 hover:text-slate-800">
        ← Board
      </Link>

      <header className="mt-2 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">Post #{p.id}</h1>
        <StatusBadge status={p.status} />
        <PlatformBadge platform={p.platform} />
      </header>
      <p className="mt-1 text-sm text-slate-600">
        <span className="font-medium text-slate-800">{p.client.name}</span> · by {p.createdBy.name}{' '}
        · goes live <span className="font-medium">{formatIst(p.scheduledAt)} IST</span> · v{p.version}
      </p>

      {timePassed && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {PAST_TIME_HINT[p.status]}
        </p>
      )}

      <div className="mt-4">
        <PostActions post={p} onReload={() => void post.refetch()} />
      </div>

      {/* grid-cols-1 = minmax(0, 1fr): the column can shrink, so long words
          wrap instead of widening the page on phones. */}
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <div className="max-w-md">
            <PostPreview
              platform={p.platform}
              clientName={p.client.name}
              caption={p.caption}
              scheduledAt={p.scheduledAt}
            />
          </div>
          <CommentThread postId={p.id} />
        </div>
        <aside className="lg:border-l lg:border-slate-200 lg:pl-6">
          <AuditTimeline postId={p.id} />
        </aside>
      </div>
    </div>
  )
}

// Shown when the post's time has gone by before it was scheduled. The API
// refuses to submit or approve such a post; this tells people what to do.
const PAST_TIME_HINT: Partial<Record<PostStatus, string>> = {
  DRAFT: 'The scheduled time has passed. Edit the post and pick a new time before submitting it.',
  CHANGES_REQUESTED: 'The scheduled time has passed. Edit the post and pick a new time before resubmitting it.',
  IN_REVIEW: 'The scheduled time has passed, so this post can no longer be approved. Request changes so the creator can pick a new time.',
  APPROVED: 'The scheduled time has passed, so this post can no longer be scheduled.',
}

function PostNotFound() {
  return (
    <EmptyState title="Post not found, or you don't have access to it">
      <Link to="/" className="font-medium text-indigo-600 hover:underline">
        Back to the board
      </Link>
    </EmptyState>
  )
}
