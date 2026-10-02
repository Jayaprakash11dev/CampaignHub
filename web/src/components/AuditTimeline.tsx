import { useAuditLog } from '../hooks/queries'
import { formatIst } from '../lib/datetime'
import { STATUS_LABEL } from '../lib/labels'
import type { AuditEntry } from '../lib/types'
import { StatusBadge } from './Badges'
import { ErrorState } from './States'

// Who changed the status, from what to what, and when (oldest first).
export function AuditTimeline({ postId }: { postId: number }) {
  const audit = useAuditLog(postId)

  return (
    <section aria-labelledby="history-heading">
      <h2 id="history-heading" className="text-sm font-semibold text-stone-700">
        History
      </h2>

      {audit.isPending ? (
        <div className="mt-3 h-32 animate-pulse rounded-lg bg-stone-100" />
      ) : audit.isError ? (
        <div className="mt-3">
          <ErrorState error={audit.error} onRetry={() => void audit.refetch()} />
        </div>
      ) : (
        <ol className="mt-3 border-l-2 border-stone-200">
          {audit.data.map((entry) => (
            <li key={entry.id} className="relative mb-4 pl-4 last:mb-0">
              <span className="absolute top-1.5 -left-[5px] h-2 w-2 rounded-full bg-brand-500" />
              <p className="text-sm text-stone-800">{describe(entry)}</p>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-stone-500">
                <StatusBadge status={entry.toStatus} />
                {formatIst(entry.timestamp)} IST
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function describe(entry: AuditEntry) {
  // A null actor means the background publish job made the change.
  const who = entry.actor ? (
    <span className="font-semibold">{entry.actor.name}</span>
  ) : (
    <span className="font-semibold">System</span>
  )

  if (entry.fromStatus === null) {
    return <>{who} created the post as a draft</>
  }
  if (entry.toStatus === 'PUBLISHED' && !entry.actor) {
    return <>{who} published the post</>
  }
  return (
    <>
      {who} moved it from {STATUS_LABEL[entry.fromStatus]} to {STATUS_LABEL[entry.toStatus]}
    </>
  )
}
