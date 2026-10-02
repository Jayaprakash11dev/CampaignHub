import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { useSingleFlight } from '../hooks/useSingleFlight'
import { api } from '../lib/api'
import { formatIst } from '../lib/datetime'
import { STATUS_LABEL } from '../lib/labels'
import type { Post, PostStatus } from '../lib/types'
import { ApiErrorAlert } from './ApiErrorAlert'

const MIN_COMMENT = 10

// The buttons come only from post.allowedTransitions, which the API works
// out with the same policy it uses to enforce the rules. The UI never has
// its own copy of "who can approve what".
export function PostActions({
  post,
  onReload,
}: {
  post: Post
  onReload: () => void
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [changesOpen, setChangesOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const transition = useMutation({
    mutationFn: async (vars: { toStatus: PostStatus; comment?: string }) => {
      const { data } = await api.post<Post>(`/posts/${post.id}/transitions`, {
        ...vars,
        version: post.version,
      })
      return data
    },
    onSuccess: async (updated) => {
      queryClient.setQueryData(['post', post.id], updated)
      setNotice(`Moved to ${STATUS_LABEL[updated.status]}.`)
      setChangesOpen(false)
      setComment('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['posts'] }),
        queryClient.invalidateQueries({ queryKey: ['audit', post.id] }),
        queryClient.invalidateQueries({ queryKey: ['comments', post.id] }),
      ])
    },
  })

  const singleFlight = useSingleFlight()
  function run(toStatus: PostStatus, withComment?: string) {
    setNotice(null)
    void singleFlight(() => transition.mutateAsync({ toStatus, comment: withComment }))
  }

  const allowed = post.allowedTransitions ?? []
  const canEdit =
    post.createdById === user?.id &&
    (post.status === 'DRAFT' || post.status === 'CHANGES_REQUESTED')
  const commentLength = comment.trim().length
  const busy = transition.isPending

  const buttonBase =
    'rounded-md px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50'
  const primary = `${buttonBase} bg-brand-600 text-white hover:bg-brand-700`
  const secondary = `${buttonBase} border border-stone-300 bg-white text-stone-700 hover:bg-stone-50`

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {allowed.includes('IN_REVIEW') && (
          <button type="button" disabled={busy} className={primary} onClick={() => run('IN_REVIEW')}>
            {post.status === 'CHANGES_REQUESTED' ? 'Resubmit for review' : 'Submit for review'}
          </button>
        )}
        {allowed.includes('APPROVED') && (
          <button
            type="button"
            disabled={busy}
            className={`${buttonBase} bg-emerald-600 text-white hover:bg-emerald-700`}
            onClick={() => run('APPROVED')}
          >
            Approve
          </button>
        )}
        {allowed.includes('CHANGES_REQUESTED') && (
          <button
            type="button"
            disabled={busy}
            className={secondary}
            aria-expanded={changesOpen}
            onClick={() => setChangesOpen((open) => !open)}
          >
            Request changes…
          </button>
        )}
        {allowed.includes('SCHEDULED') && (
          <button type="button" disabled={busy} className={primary} onClick={() => run('SCHEDULED')}>
            Schedule for {formatIst(post.scheduledAt, 'D MMM, h:mm A')} IST
          </button>
        )}
        {canEdit && (
          <Link to={`/posts/${post.id}/edit`} className={secondary}>
            Edit
          </Link>
        )}
        {allowed.length === 0 && !canEdit && (
          <p className="text-sm text-stone-500">{waitingText(post)}</p>
        )}
      </div>

      {changesOpen && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
          <label className="block text-sm font-medium text-stone-700">
            What needs to change?
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-normal"
              placeholder="Explain what the creator should change…"
            />
          </label>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span
              className={`text-xs ${commentLength >= MIN_COMMENT ? 'text-emerald-700' : 'text-stone-500'}`}
            >
              {commentLength}/{MIN_COMMENT} characters minimum
            </span>
            <button
              type="button"
              disabled={busy || commentLength < MIN_COMMENT}
              className={`${buttonBase} bg-red-600 text-white hover:bg-red-700`}
              onClick={() => run('CHANGES_REQUESTED', comment)}
            >
              Send back for changes
            </button>
          </div>
        </div>
      )}

      {notice && !transition.isError && (
        <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </p>
      )}
      {transition.isError && (
        <ApiErrorAlert
          error={transition.error}
          onReload={() => {
            transition.reset()
            onReload()
          }}
        />
      )}
    </div>
  )
}

function waitingText(post: Post): string {
  switch (post.status) {
    case 'PUBLISHED':
      return 'This post has been published.'
    case 'SCHEDULED':
      return `Scheduled. It will be published automatically at ${formatIst(post.scheduledAt)} IST.`
    case 'IN_REVIEW':
      return 'Waiting for a reviewer.'
    case 'APPROVED':
      return 'Approved. Waiting for the creator to schedule it.'
    case 'CHANGES_REQUESTED':
      return 'Waiting for the creator to make changes.'
    default:
      return 'Waiting for the creator to submit it for review.'
  }
}
