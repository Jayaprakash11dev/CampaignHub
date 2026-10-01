import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { ApiErrorAlert } from '../components/ApiErrorAlert'
import { StatusBadge } from '../components/Badges'
import { PostPreview } from '../components/PostPreview'
import { EmptyState, ErrorState } from '../components/States'
import { useClients, usePost } from '../hooks/queries'
import { api } from '../lib/api'
import { CAPTION_LIMITS, captionLength } from '../lib/caption'
import { fromIstInput, nowIstInput, toIstInput } from '../lib/datetime'
import { PLATFORM_LABEL, PLATFORMS } from '../lib/labels'
import type { Client, Platform, Post } from '../lib/types'

const EDITABLE_STATUSES = ['DRAFT', 'CHANGES_REQUESTED']

// Used for both /posts/new and /posts/:id/edit.
export function PostEditorPage() {
  const { id } = useParams()
  const postId = id ? Number(id) : undefined
  const isEdit = postId !== undefined
  const { user } = useAuth()

  const post = usePost(postId)
  const clients = useClients()

  if (isEdit && post.isPending) {
    return <p className="text-sm text-slate-500">Loading post…</p>
  }
  if (isEdit && post.isError) {
    return <ErrorState error={post.error} onRetry={() => void post.refetch()} />
  }
  if (clients.isError) {
    return <ErrorState error={clients.error} onRetry={() => void clients.refetch()} />
  }

  // The API refuses these edits too; this just explains it up front.
  if (post.data) {
    const notMine = post.data.createdById !== user?.id
    const locked = !EDITABLE_STATUSES.includes(post.data.status)
    if (notMine || locked) {
      return (
        <EmptyState title="This post can't be edited right now">
          <p>
            {notMine
              ? 'Only the creator of a post can edit it.'
              : 'Posts can only be edited while they are a draft or have changes requested.'}
          </p>
          <p className="mt-2 inline-flex items-center gap-2">
            Current status: <StatusBadge status={post.data.status} />
          </p>
          <p className="mt-3">
            <Link to={`/posts/${post.data.id}`} className="font-medium text-indigo-600 hover:underline">
              Back to the post
            </Link>
          </p>
        </EmptyState>
      )
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">
        {isEdit ? `Edit post #${postId}` : 'New post'}
      </h1>
      {post.data?.status === 'CHANGES_REQUESTED' && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          The reviewer asked for changes.{' '}
          <Link to={`/posts/${post.data.id}`} className="font-medium underline">
            Read their feedback
          </Link>
          , update the post, then submit it for review again.
        </p>
      )}
      {/* Keyed by version: after "Load latest version" the refetched post
          has a new version, so the form starts again from the fresh data. */}
      <EditorForm
        key={post.data?.version ?? 'new'}
        post={post.data}
        clients={clients.data ?? []}
        onReload={() => void post.refetch()}
      />
    </div>
  )
}

interface EditorFormProps {
  post?: Post
  clients: Client[]
  onReload: () => void
}

function EditorForm({ post, clients, onReload }: EditorFormProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const initialTime = post ? toIstInput(post.scheduledAt) : ''
  const [clientId, setClientId] = useState(post ? String(post.clientId) : '')
  const [platform, setPlatform] = useState<Platform>(post?.platform ?? 'INSTAGRAM')
  const [caption, setCaption] = useState(post?.caption ?? '')
  const [scheduledLocal, setScheduledLocal] = useState(initialTime)

  const limit = CAPTION_LIMITS[platform]
  const length = captionLength(caption)
  const overLimit = length > limit
  const nearLimit = !overLimit && length > limit * 0.9

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        clientId: Number(clientId),
        platform,
        caption,
      }
      // The input only has minutes. Re-sending an unchanged time would drop
      // the seconds and look like a new slot to the API, so only send it
      // when the user actually changed it.
      if (!post || scheduledLocal !== initialTime) {
        body.scheduledAt = fromIstInput(scheduledLocal)
      }

      if (post) {
        const { data } = await api.patch<Post>(`/posts/${post.id}`, {
          ...body,
          version: post.version,
        })
        return data
      }
      const { data } = await api.post<Post>('/posts', body)
      return data
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['posts'] })
      await queryClient.invalidateQueries({ queryKey: ['post', saved.id] })
      navigate(`/posts/${saved.id}`)
    },
  })

  const canSave =
    clientId !== '' &&
    scheduledLocal !== '' &&
    caption.trim() !== '' &&
    !overLimit &&
    !save.isPending

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (canSave) save.mutate()
  }

  const clientName = clients.find((c) => String(c.id) === clientId)?.name ?? ''

  return (
    <div className="mt-4 grid gap-8 lg:grid-cols-2">
      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Client</span>
          <select
            required
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Select a client…</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Platform</legend>
          <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={platform === p}
                onClick={() => setPlatform(p)}
                className={`rounded-md border px-3 py-2 text-sm font-medium ${
                  platform === p
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {PLATFORM_LABEL[p]}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="flex items-baseline justify-between text-sm font-medium text-slate-700">
            Caption
            <span
              data-testid="caption-counter"
              className={`text-xs tabular-nums ${
                overLimit ? 'font-semibold text-red-600' : nearLimit ? 'text-amber-600' : 'text-slate-500'
              }`}
            >
              {length.toLocaleString()} / {limit.toLocaleString()}
            </span>
          </span>
          <textarea
            required
            rows={8}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${
              overLimit ? 'border-red-400 focus:outline-red-500' : 'border-slate-300'
            }`}
            placeholder="Write the post…"
          />
          {overLimit && (
            <span className="text-xs text-red-600">
              {PLATFORM_LABEL[platform]} allows {limit.toLocaleString()} characters. Remove{' '}
              {(length - limit).toLocaleString()} to save.
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Scheduled time (IST)</span>
          <input
            type="datetime-local"
            required
            min={nowIstInput()}
            value={scheduledLocal}
            onChange={(e) => setScheduledLocal(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <span className="text-xs text-slate-500">
            Posts for the same client and platform must be at least 2 hours apart.
          </span>
        </label>

        {save.isError && <ApiErrorAlert error={save.error} onReload={onReload} />}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!canSave}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : post ? 'Save changes' : 'Create draft'}
          </button>
          <Link
            to={post ? `/posts/${post.id}` : '/'}
            className="text-sm text-slate-600 hover:underline"
          >
            Cancel
          </Link>
        </div>
      </form>

      {/* Phone-width preview, like a real feed. */}
      <div className="w-full max-w-md lg:sticky lg:top-24 lg:self-start">
        <PostPreview
          platform={platform}
          clientName={clientName}
          caption={caption}
          scheduledAt={scheduledLocal ? fromIstInput(scheduledLocal) : null}
        />
      </div>
    </div>
  )
}
