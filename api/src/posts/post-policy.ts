import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Post, PostStatus, Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import {
  ALLOWED_TRANSITIONS,
  EDITABLE_STATUSES,
  isEditable,
} from './post-workflow';

// Who is allowed to do what with a post. Plain functions, so they can be
// unit tested without a database.
//
// post-workflow.ts answers "is this status change valid at all?"
// This file answers "is *this user* allowed to make it?"

type PostForPolicy = Pick<Post, 'createdById' | 'status'>;

export const MIN_CHANGE_REQUEST_COMMENT = 10;

export function assertCanEdit(user: AuthUser, post: PostForPolicy): void {
  if (post.createdById !== user.id) {
    throw new ForbiddenException('Only the creator of this post can edit it');
  }
  if (!isEditable(post.status)) {
    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      code: 'POST_NOT_EDITABLE',
      message: `Posts can only be edited in ${EDITABLE_STATUSES.join(' or ')} (this one is ${post.status})`,
    });
  }
}

// Returns why the user can't move the post to `to`, or null if they can.
// `isAssignedReviewer` = the user is a reviewer assigned to the post's client.
export function transitionDenialReason(
  user: AuthUser,
  post: PostForPolicy,
  to: PostStatus,
  isAssignedReviewer: boolean,
): string | null {
  const isAuthor = post.createdById === user.id;

  switch (to) {
    case PostStatus.IN_REVIEW:
      return isAuthor
        ? null
        : 'Only the creator of this post can submit it for review';

    case PostStatus.APPROVED:
    case PostStatus.CHANGES_REQUESTED:
      if (user.role !== Role.REVIEWER || !isAssignedReviewer) {
        return 'Only a reviewer assigned to this client can review this post';
      }
      // Checked separately from the role: a creator who is later made a
      // reviewer for the same client must still not approve their own post.
      if (isAuthor) {
        return 'You cannot approve or review your own post';
      }
      return null;

    case PostStatus.SCHEDULED:
      return isAuthor || user.role === Role.ADMIN
        ? null
        : 'Only the creator of this post or an admin can schedule it';

    case PostStatus.PUBLISHED:
      return 'Posts are published automatically when their scheduled time passes';

    default:
      return `Posts cannot be moved to ${to}`;
  }
}

export function assertCanTransition(
  user: AuthUser,
  post: PostForPolicy,
  to: PostStatus,
  isAssignedReviewer: boolean,
): void {
  const reason = transitionDenialReason(user, post, to, isAssignedReviewer);
  if (reason) {
    throw new ForbiddenException(reason);
  }
}

// Moving forward to these statuses needs the scheduled time to still be in
// the future (the service checks it with assertInFuture).
const NEEDS_FUTURE_TIME: readonly PostStatus[] = [
  PostStatus.IN_REVIEW,
  PostStatus.APPROVED,
  PostStatus.SCHEDULED,
];

// The next statuses this user can move the post to right now. Sent to the
// frontend so it only shows buttons for actions that will succeed.
export function allowedTransitionsFor(
  user: AuthUser,
  post: PostForPolicy & { scheduledAt: Date },
  isAssignedReviewer: boolean,
  now: Date = new Date(),
): PostStatus[] {
  const timePassed = post.scheduledAt.getTime() <= now.getTime();
  return ALLOWED_TRANSITIONS[post.status].filter(
    (to) =>
      transitionDenialReason(user, post, to, isAssignedReviewer) === null &&
      !(timePassed && NEEDS_FUTURE_TIME.includes(to)),
  );
}

export function assertChangeRequestComment(comment?: string): void {
  if ((comment ?? '').trim().length >= MIN_CHANGE_REQUEST_COMMENT) {
    return;
  }
  throw new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    code: 'COMMENT_REQUIRED',
    message: `Requesting changes needs a comment of at least ${MIN_CHANGE_REQUEST_COMMENT} characters`,
  });
}
