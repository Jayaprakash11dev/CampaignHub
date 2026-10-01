import { Link, useParams } from 'react-router'
import { AuditTimeline } from '../components/AuditTimeline'
import { PlatformBadge, StatusBadge } from '../components/Badges'
import { CommentThread } from '../components/CommentThread'
import { PostActions } from '../components/PostActions'
import { PostPreview } from '../components/PostPreview'
import { EmptyState, ErrorState } from '../components/States'
import { usePost } from '../hooks/queries'
import { getApiError } from '../lib/api-error'
import { formatIst } from '../lib/datetime'

export function PostDetailPage() {
  const postId = Number(useParams().id)
  const post = usePost(postId)

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
      return (
        <EmptyState title="Post not found, or you don't have access to it">
          <Link to="/" className="font-medium text-indigo-600 hover:underline">
            Back to the board
          </Link>
        </EmptyState>
      )
    }
    return <ErrorState error={post.error} onRetry={() => void post.refetch()} />
  }

  const p = post.data

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

      <div className="mt-4">
        <PostActions post={p} onReload={() => void post.refetch()} />
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
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
