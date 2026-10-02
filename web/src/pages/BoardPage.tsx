import { Plus, X as XIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { PlatformIcon } from '../components/PlatformIcon'
import { PostCard } from '../components/PostCard'
import { EmptyState, ErrorState } from '../components/States'
import { useClients, usePosts, type PostFilters } from '../hooks/queries'
import { PLATFORM_LABEL, PLATFORMS, STATUS_DOT, STATUS_LABEL, STATUS_ORDER } from '../lib/labels'
import type { Platform, Post, PostStatus } from '../lib/types'

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
  const clientCount = new Set(posts.data?.map((p) => p.clientId)).size

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Board</h1>
          <p className="mt-1 text-sm text-stone-500">
            {isReviewer && clients.data
              ? `Posts for your clients: ${clients.data.map((c) => c.name).join(', ') || 'none assigned yet'}`
              : 'Every post, from first draft to published.'}
          </p>
        </div>
        {isCreator && (
          <Link
            to="/posts/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            <Plus aria-hidden className="h-4 w-4" />
            New post
          </Link>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200 bg-white p-2.5 shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
        <select
          aria-label="Filter by client"
          value={filters.clientId ?? ''}
          onChange={(e) => setFilter('client', e.target.value)}
          className="rounded-full border border-stone-200 bg-stone-50 py-1.5 pr-8 pl-3.5 text-sm font-medium text-stone-800 hover:border-stone-300"
        >
          <option value="">All clients</option>
          {clients.data?.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>

        <div role="group" aria-label="Filter by platform" className="flex flex-wrap items-center gap-1">
          <PlatformChip active={!filters.platform} onClick={() => setFilter('platform', '')} label="All platforms">
            All
          </PlatformChip>
          {PLATFORMS.map((platform: Platform) => (
            <PlatformChip
              key={platform}
              active={filters.platform === platform}
              onClick={() => setFilter('platform', platform)}
              label={PLATFORM_LABEL[platform]}
            >
              <PlatformIcon platform={platform} className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{PLATFORM_LABEL[platform]}</span>
            </PlatformChip>
          ))}
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-900"
          >
            <XIcon aria-hidden className="h-3.5 w-3.5" />
            Clear filters
          </button>
        )}

        {posts.data && (
          <span className="ml-auto pr-2 text-sm text-stone-500">
            <span className="font-semibold text-stone-900">{posts.data.length}</span>{' '}
            {posts.data.length === 1 ? 'post' : 'posts'}
            {clientCount > 0 && (
              <>
                {' · '}
                <span className="font-semibold text-stone-900">{clientCount}</span>{' '}
                {clientCount === 1 ? 'client' : 'clients'}
              </>
            )}
          </span>
        )}
      </div>

      <div className="mt-5">
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
                className="font-medium text-brand-700 hover:underline"
              >
                Clear filters
              </button>
            </EmptyState>
          ) : (
            <EmptyState title="No posts yet">
              {isCreator ? (
                <Link to="/posts/new" className="font-medium text-brand-700 hover:underline">
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

function PlatformChip({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-stone-900 text-white'
          : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
      }`}
    >
      {children}
    </button>
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
    <div className="flex gap-3 overflow-x-auto pb-4">
      {STATUS_ORDER.map((status) => {
        const columnPosts = byStatus.get(status) ?? []
        return (
          <section
            key={status}
            aria-label={status}
            className="flex w-72 shrink-0 flex-col rounded-2xl border border-stone-200/70 bg-stone-100/70 p-2.5 xl:w-auto xl:min-w-0 xl:flex-1"
          >
            <header className="mb-2.5 flex items-center justify-between px-1.5 pt-1">
              <div className="flex min-w-0 items-center gap-2">
                <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[status]}`} />
                <h2 className="truncate text-[13px] font-semibold text-stone-800">{STATUS_LABEL[status]}</h2>
              </div>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-stone-500 shadow-xs">
                {columnPosts.length}
              </span>
            </header>
            <div className="flex flex-col gap-2">
              {columnPosts.length === 0 ? (
                <p className="rounded-xl border border-dashed border-stone-300 py-8 text-center text-xs text-stone-400">
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
    <div className="flex gap-3 overflow-hidden" aria-label="Loading posts">
      {STATUS_ORDER.map((status) => (
        <div key={status} className="w-72 shrink-0 rounded-2xl bg-stone-100 p-2.5 xl:w-auto xl:flex-1">
          <div className="mb-3 h-5 w-24 animate-pulse rounded bg-stone-200" />
          {[0, 1].map((i) => (
            <div key={i} className="mb-2 h-32 animate-pulse rounded-xl bg-white" />
          ))}
        </div>
      ))}
    </div>
  )
}
