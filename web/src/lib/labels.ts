import type { Platform, PostStatus } from './types'

// Workflow order, used for the board columns.
export const STATUS_ORDER: PostStatus[] = [
  'DRAFT',
  'IN_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED',
]

export const STATUS_LABEL: Record<PostStatus, string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In review',
  CHANGES_REQUESTED: 'Changes requested',
  APPROVED: 'Approved',
  SCHEDULED: 'Scheduled',
  PUBLISHED: 'Published',
}

// Badge colours. The palette deliberately has no blue.
export const STATUS_STYLE: Record<PostStatus, string> = {
  DRAFT: 'bg-stone-100 text-stone-700',
  IN_REVIEW: 'bg-amber-100 text-amber-800',
  CHANGES_REQUESTED: 'bg-rose-100 text-rose-700',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  SCHEDULED: 'bg-brand-100 text-brand-800',
  PUBLISHED: 'bg-fuchsia-100 text-fuchsia-800',
}

// Solid colour for dots and the left edge of calendar blocks.
export const STATUS_DOT: Record<PostStatus, string> = {
  DRAFT: 'bg-stone-400',
  IN_REVIEW: 'bg-amber-500',
  CHANGES_REQUESTED: 'bg-rose-500',
  APPROVED: 'bg-emerald-500',
  SCHEDULED: 'bg-brand-500',
  PUBLISHED: 'bg-fuchsia-600',
}

// Soft background for calendar blocks.
export const STATUS_TINT: Record<PostStatus, string> = {
  DRAFT: 'bg-stone-50 hover:bg-stone-100',
  IN_REVIEW: 'bg-amber-50 hover:bg-amber-100',
  CHANGES_REQUESTED: 'bg-rose-50 hover:bg-rose-100',
  APPROVED: 'bg-emerald-50 hover:bg-emerald-100',
  SCHEDULED: 'bg-brand-50 hover:bg-brand-100',
  PUBLISHED: 'bg-fuchsia-50 hover:bg-fuchsia-100',
}

export const PLATFORMS: Platform[] = ['INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'X']

export const PLATFORM_LABEL: Record<Platform, string> = {
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  LINKEDIN: 'LinkedIn',
  X: 'X',
}
