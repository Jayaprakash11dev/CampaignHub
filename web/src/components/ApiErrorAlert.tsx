import { Link } from 'react-router'
import { getApiError } from '../lib/api-error'

// Shows an API error from a form or action. Most errors are just their
// message; a few codes get an extra way out for the user.
export function ApiErrorAlert({
  error,
  onReload,
}: {
  error: unknown
  // Called by the "Load latest version" button (VERSION_MISMATCH and
  // INVALID_TRANSITION).
  onReload?: () => void
}) {
  const apiError = getApiError(error)

  return (
    <div
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <p className="font-medium">{apiError.message}</p>

      {apiError.code === 'SCHEDULE_CONFLICT' && apiError.conflictingPostId && (
        <p className="mt-1">
          Pick a time at least 2 hours away, or{' '}
          <Link
            to={`/posts/${apiError.conflictingPostId}`}
            target="_blank"
            className="font-semibold underline"
          >
            view post #{apiError.conflictingPostId}
          </Link>
          .
        </p>
      )}

      {/* Both usually mean the page is out of date: someone else edited
          or moved the post since it was loaded. */}
      {(apiError.code === 'VERSION_MISMATCH' ||
        apiError.code === 'INVALID_TRANSITION') &&
        onReload && (
        <button
          type="button"
          onClick={onReload}
          className="mt-2 rounded-md bg-white px-3 py-1 font-medium text-red-700 ring-1 ring-red-300 hover:bg-red-100"
        >
          Load latest version
        </button>
      )}

      {apiError.code === 'VALIDATION_FAILED' &&
        apiError.details &&
        apiError.details.length > 1 && (
          <ul className="mt-1 list-disc pl-5">
            {apiError.details.slice(1).map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        )}
    </div>
  )
}
