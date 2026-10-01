import { BadRequestException } from '@nestjs/common';
import { PostStatus } from '@prisma/client';

// The status workflow from the brief:
//
//   DRAFT → IN_REVIEW → APPROVED → SCHEDULED → PUBLISHED
//   IN_REVIEW → CHANGES_REQUESTED → IN_REVIEW
//
// This map is the single source of truth. Anything not listed here is
// rejected with a 400.
export const ALLOWED_TRANSITIONS: Record<PostStatus, readonly PostStatus[]> = {
  [PostStatus.DRAFT]: [PostStatus.IN_REVIEW],
  [PostStatus.IN_REVIEW]: [PostStatus.APPROVED, PostStatus.CHANGES_REQUESTED],
  [PostStatus.CHANGES_REQUESTED]: [PostStatus.IN_REVIEW],
  [PostStatus.APPROVED]: [PostStatus.SCHEDULED],
  [PostStatus.SCHEDULED]: [PostStatus.PUBLISHED],
  [PostStatus.PUBLISHED]: [],
};

// Posts can only be edited by their creator while in one of these statuses.
export const EDITABLE_STATUSES: readonly PostStatus[] = [
  PostStatus.DRAFT,
  PostStatus.CHANGES_REQUESTED,
];

export function isTransitionAllowed(from: PostStatus, to: PostStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: PostStatus, to: PostStatus): void {
  if (isTransitionAllowed(from, to)) {
    return;
  }

  const allowed = ALLOWED_TRANSITIONS[from];
  const hint =
    allowed.length > 0
      ? `Allowed next statuses: ${allowed.join(', ')}`
      : `${from} is a final status`;

  throw new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    code: 'INVALID_TRANSITION',
    message: `Cannot move a post from ${from} to ${to}. ${hint}`,
  });
}

export function isEditable(status: PostStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}
