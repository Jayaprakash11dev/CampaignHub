import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Post } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { EDITABLE_STATUSES, isEditable } from './post-workflow';

// Who is allowed to do what with a post. Plain functions, so they can be
// unit tested without a database.

type PostForPolicy = Pick<Post, 'createdById' | 'status'>;

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
