import type { ReactNode } from 'react'
import { getApiError } from '../lib/api-error'

// Shared "something went wrong" and "nothing here" panels.

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown
  onRetry?: () => void
}) {
  const { message } = getApiError(error)
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 p-6 text-center"
    >
      <p className="font-medium text-red-800">Could not load this page</p>
      <p className="mt-1 text-sm text-red-700">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-red-700 ring-1 ring-red-300 hover:bg-red-100"
        >
          Retry
        </button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      {children && <div className="mt-2 text-sm text-slate-500">{children}</div>}
    </div>
  )
}
