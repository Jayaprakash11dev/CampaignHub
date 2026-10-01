// Shapes of the data returned by the API. These are written by hand to
// match the NestJS/Prisma models in api/. The project is small enough that
// a shared types package would be more setup than it's worth.

export type Role = 'ADMIN' | 'CREATOR' | 'REVIEWER'

export type Platform = 'INSTAGRAM' | 'FACEBOOK' | 'LINKEDIN' | 'X'

export type PostStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PUBLISHED'

export interface User {
  id: number
  name: string
  email: string
  role: Role
}

// As returned by the admin-only /users endpoints.
export interface AdminUser extends User {
  createdAt: string
}

export interface UserSummary {
  id: number
  name: string
  role?: Role
}

export interface Client {
  id: number
  name: string
  createdAt: string
  reviewers: { id: number; name: string; email: string }[]
  _count: { posts: number }
}

export interface Post {
  id: number
  clientId: number
  platform: Platform
  caption: string
  // ISO string in UTC. Convert to IST only for display.
  scheduledAt: string
  status: PostStatus
  createdById: number
  version: number
  createdAt: string
  updatedAt: string
  client: { id: number; name: string }
  createdBy: UserSummary
  // Only on GET /posts/:id and mutation responses.
  allowedTransitions?: PostStatus[]
}

export interface Comment {
  id: number
  postId: number
  message: string
  createdAt: string
  author: UserSummary
}

export interface AuditEntry {
  id: number
  postId: number
  fromStatus: PostStatus | null
  toStatus: PostStatus
  timestamp: string
  // null when the change was made by the publish job.
  actor: UserSummary | null
}

// Every error response from the API has this shape
// (see api/src/common/http-exception.filter.ts).
export interface ApiErrorBody {
  statusCode: number
  code: string
  message: string
  details?: string[]
  conflictingPostId?: number
  currentVersion?: number
}
