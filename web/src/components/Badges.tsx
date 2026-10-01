import {
  PLATFORM_LABEL,
  PLATFORM_STYLE,
  STATUS_LABEL,
  STATUS_STYLE,
} from '../lib/labels'
import type { Platform, PostStatus } from '../lib/types'

const base = 'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium'

export function StatusBadge({ status }: { status: PostStatus }) {
  return (
    <span className={`${base} ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

export function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <span className={`${base} ${PLATFORM_STYLE[platform]}`}>
      {PLATFORM_LABEL[platform]}
    </span>
  )
}
