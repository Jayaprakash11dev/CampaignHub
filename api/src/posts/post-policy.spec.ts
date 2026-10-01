import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PostStatus, Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { assertCanEdit } from './post-policy';

const author: AuthUser = {
  id: 1,
  name: 'Asha',
  email: 'asha@test.com',
  role: Role.CREATOR,
};
const otherCreator: AuthUser = {
  id: 2,
  name: 'Ben',
  email: 'ben@test.com',
  role: Role.CREATOR,
};

const postIn = (status: PostStatus) => ({ createdById: author.id, status });

describe('assertCanEdit', () => {
  it.each([PostStatus.DRAFT, PostStatus.CHANGES_REQUESTED])(
    'lets the author edit a %s post',
    (status) => {
      expect(() => assertCanEdit(author, postIn(status))).not.toThrow();
    },
  );

  it('stops anyone other than the author with a 403', () => {
    expect(() => assertCanEdit(otherCreator, postIn(PostStatus.DRAFT))).toThrow(
      ForbiddenException,
    );
  });

  it.each([
    PostStatus.IN_REVIEW,
    PostStatus.APPROVED,
    PostStatus.SCHEDULED,
    PostStatus.PUBLISHED,
  ])('stops the author editing a %s post with a 400', (status) => {
    let error: unknown;
    try {
      assertCanEdit(author, postIn(status));
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({
      code: 'POST_NOT_EDITABLE',
    });
  });

  it('checks the author before the status', () => {
    // A non-author gets 403 even when the status would also block them.
    expect(() =>
      assertCanEdit(otherCreator, postIn(PostStatus.IN_REVIEW)),
    ).toThrow(ForbiddenException);
  });
});
