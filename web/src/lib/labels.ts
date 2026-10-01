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

export const STATUS_STYLE: Record<PostStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  IN_REVIEW: 'bg-amber-100 text-amber-800',
  CHANGES_REQUESTED: 'bg-red-100 text-red-700',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  SCHEDULED: 'bg-sky-100 text-sky-800',
  PUBLISHED: 'bg-indigo-100 text-indigo-800',
}

export const PLATFORMS: Platform[] = ['INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'X']

export const PLATFORM_LABEL: Record<Platform, string> = {
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  LINKEDIN: 'LinkedIn',
  X: 'X',
}

export const PLATFORM_STYLE: Record<Platform, string> = {
  INSTAGRAM: 'bg-pink-100 text-pink-700',
  FACEBOOK: 'bg-blue-100 text-blue-700',
  LINKEDIN: 'bg-sky-100 text-sky-800',
  X: 'bg-slate-900 text-white',
}
