import { PLATFORM_LABEL, STATUS_DOT, STATUS_LABEL, STATUS_STYLE } from '../lib/labels'
import type { Platform, PostStatus } from '../lib/types'
import { PlatformIcon } from './PlatformIcon'

const base = 'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium'

export function StatusBadge({ status }: { status: PostStatus }) {
  return (
    <span className={`${base} ${STATUS_STYLE[status]}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {STATUS_LABEL[status]}
    </span>
  )
}

// Logo + name. The name stays visible: it's clearer than a logo alone and
// keeps the badge readable for screen readers.
export function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <span className={`${base} bg-stone-100 text-stone-800`}>
      <PlatformIcon platform={platform} className="h-3 w-3" />
      {PLATFORM_LABEL[platform]}
    </span>
  )
}
