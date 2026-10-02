import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useComments } from '../hooks/queries'
import { useSingleFlight } from '../hooks/useSingleFlight'
import { api } from '../lib/api'
import { formatIst } from '../lib/datetime'
import { ApiErrorAlert } from './ApiErrorAlert'
import { Avatar } from './Avatar'
import { ErrorState } from './States'

export function CommentThread({ postId }: { postId: number }) {
  const comments = useComments(postId)
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')

  const add = useMutation({
    mutationFn: async () => {
      await api.post(`/posts/${postId}/comments`, { message })
    },
    onSuccess: async () => {
      setMessage('')
      await queryClient.invalidateQueries({ queryKey: ['comments', postId] })
    },
  })

  // A double click must not post the comment twice.
  const singleFlight = useSingleFlight()
  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (message.trim()) void singleFlight(() => add.mutateAsync())
  }

  return (
    <section aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="text-sm font-semibold text-stone-700">
        Comments {comments.data && `(${comments.data.length})`}
      </h2>

      <div className="mt-3 space-y-3">
        {comments.isPending ? (
          <div className="h-16 animate-pulse rounded-lg bg-stone-100" />
        ) : comments.isError ? (
          <ErrorState error={comments.error} onRetry={() => void comments.refetch()} />
        ) : comments.data.length === 0 ? (
          <p className="text-sm text-stone-500">No comments yet.</p>
        ) : (
          comments.data.map((comment) => (
            <article key={comment.id} className="rounded-lg border border-stone-200 bg-white p-3">
              <header className="flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
                <Avatar name={comment.author.name} size="xs" />
                <span className="text-sm font-semibold text-stone-800">{comment.author.name}</span>
                {comment.author.role && <span>{comment.author.role.toLowerCase()}</span>}
                <span>· {formatIst(comment.createdAt)} IST</span>
              </header>
              <p className="mt-1 text-sm whitespace-pre-wrap text-stone-800">{comment.message}</p>
            </article>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-2">
        <textarea
          aria-label="Add a comment"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Add a comment…"
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
        />
        {add.isError && <ApiErrorAlert error={add.error} />}
        <button
          type="submit"
          disabled={!message.trim() || add.isPending}
          className="rounded-md bg-stone-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {add.isPending ? 'Posting…' : 'Post comment'}
        </button>
      </form>
    </section>
  )
}
