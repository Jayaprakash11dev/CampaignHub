import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { StatusBadge } from '../components/Badges'
import { PostCard } from '../components/PostCard'
import { EmptyState, ErrorState } from '../components/States'
import { useClients, usePosts, type PostFilters } from '../hooks/queries'
import { PLATFORM_LABEL, PLATFORMS, STATUS_ORDER } from '../lib/labels'
import type { Post, PostStatus } from '../lib/types'

const selectClass =
  'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none'

export function BoardPage() {
  const { user } = useAuth()
  // Filters live in the URL (?client=2&platform=X), so they survive a
  // reload, can be shared as a link and work with back/forward.
  const [searchParams, setSearchParams] = useSearchParams()
  const filters: PostFilters = {
    clientId: Number(searchParams.get('client')) || undefined,
    // Unknown values (e.g. a hand-edited URL) are ignored, not sent to the API.
    platform: PLATFORMS.find((p) => p === searchParams.get('platform')),
  }
  const hasFilters = Boolean(filters.clientId || filters.platform)

  const posts = usePosts(filters)
  const clients = useClients()

  function setFilter(key: 'client' | 'platform', value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }

  const isCreator = user?.role === 'CREATOR'
  const isReviewer = user?.role === 'REVIEWER'

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Board</h1>
          {isReviewer && clients.data && (
            <p className="text-sm text-slate-500">
              Showing posts for your clients:{' '}
              {clients.data.map((c) => c.name).join(', ') || 'none assigned yet'}
            </p>
          )}
        </div>
        {isCreator && (
          <Link
            to="/posts/new"
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            + New post
          </Link>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          aria-label="Filter by client"
          value={filters.clientId ?? ''}
          onChange={(e) => setFilter('client', e.target.value)}
          className={selectClass}
        >
          <option value="">All clients</option>
          {clients.data?.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by platform"
          value={filters.platform ?? ''}
          onChange={(e) => setFilter('platform', e.target.value)}
          className={selectClass}
        >
          <option value="">All platforms</option>
          {PLATFORMS.map((platform) => (
            <option key={platform} value={platform}>
              {PLATFORM_LABEL[platform]}
            </option>
          ))}
        </select>

        {hasFilters && (
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            Clear filters
          </button>
        )}

        {posts.data && (
          <span className="ml-auto text-sm text-slate-500">
            {posts.data.length} {posts.data.length === 1 ? 'post' : 'posts'}
          </span>
        )}
      </div>

      <div className="mt-4">
        {posts.isPending ? (
          <BoardSkeleton />
        ) : posts.isError ? (
          <ErrorState error={posts.error} onRetry={() => void posts.refetch()} />
        ) : posts.data.length === 0 ? (
          hasFilters ? (
            <EmptyState title="No posts match these filters">
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className="font-medium text-indigo-600 hover:underline"
              >
                Clear filters
              </button>
            </EmptyState>
          ) : (
            <EmptyState title="No posts yet">
              {isCreator ? (
                <Link to="/posts/new" className="font-medium text-indigo-600 hover:underline">
                  Create the first post
                </Link>
              ) : (
                'Posts will appear here once creators start writing them.'
              )}
            </EmptyState>
          )
        ) : (
          <Board posts={posts.data} currentUserId={user?.id} />
        )}
      </div>
    </div>
  )
}

function Board({ posts, currentUserId }: { posts: Post[]; currentUserId?: number }) {
  // One GET /posts call, grouped by status here. Posts arrive sorted by
  // scheduled time, so each column is in date order too.
  const byStatus = new Map<PostStatus, Post[]>(STATUS_ORDER.map((s) => [s, []]))
  for (const post of posts) {
    byStatus.get(post.status)?.push(post)
  }

  return (
    // Scrolls sideways inside this container on small screens; the page
    // itself never scrolls horizontally.
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STATUS_ORDER.map((status) => {
        const columnPosts = byStatus.get(status) ?? []
        return (
          <section
            key={status}
            aria-label={status}
            className="flex w-72 shrink-0 flex-col rounded-xl bg-slate-100 p-3 xl:w-auto xl:min-w-0 xl:flex-1"
          >
            <header className="mb-3 flex items-center justify-between">
              <StatusBadge status={status} />
              <span className="text-xs font-medium text-slate-500">{columnPosts.length}</span>
            </header>
            <div className="flex flex-col gap-2">
              {columnPosts.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 py-6 text-center text-xs text-slate-400">
                  No posts
                </p>
              ) : (
                columnPosts.map((post) => (
                  <PostCard key={post.id} post={post} isMine={post.createdById === currentUserId} />
                ))
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function BoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden" aria-label="Loading posts">
      {STATUS_ORDER.map((status) => (
        <div key={status} className="w-72 shrink-0 rounded-xl bg-slate-100 p-3 xl:w-auto xl:flex-1">
          <div className="mb-3 h-5 w-24 animate-pulse rounded bg-slate-200" />
          {[0, 1].map((i) => (
            <div key={i} className="mb-2 h-28 animate-pulse rounded-lg bg-white" />
          ))}
        </div>
      ))}
    </div>
  )
}
