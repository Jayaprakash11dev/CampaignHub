import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PostStatus, Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import {
  allowedTransitionsFor,
  assertCanEdit,
  assertCanTransition,
  assertChangeRequestComment,
  transitionDenialReason,
} from './post-policy';

const user = (id: number, role: Role): AuthUser => ({
  id,
  name: `User ${id}`,
  email: `user${id}@test.com`,
  role,
});

const author = user(1, Role.CREATOR);
const otherCreator = user(2, Role.CREATOR);
const reviewer = user(3, Role.REVIEWER);
const admin = user(4, Role.ADMIN);

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

describe('transitionDenialReason', () => {
  const { IN_REVIEW, APPROVED, CHANGES_REQUESTED, SCHEDULED, PUBLISHED } =
    PostStatus;

  // [description, user, target status, assigned reviewer?, allowed?]
  const cases: [string, AuthUser, PostStatus, boolean, boolean][] = [
    ['author submits for review', author, IN_REVIEW, false, true],
    ['other creator submits for review', otherCreator, IN_REVIEW, false, false],
    ['assigned reviewer approves', reviewer, APPROVED, true, true],
    [
      'assigned reviewer requests changes',
      reviewer,
      CHANGES_REQUESTED,
      true,
      true,
    ],
    ['unassigned reviewer approves', reviewer, APPROVED, false, false],
    ['creator approves', otherCreator, APPROVED, false, false],
    ['admin approves', admin, APPROVED, false, false],
    ['author schedules', author, SCHEDULED, false, true],
    ['admin schedules', admin, SCHEDULED, false, true],
    ['reviewer schedules', reviewer, SCHEDULED, true, false],
    ['other creator schedules', otherCreator, SCHEDULED, false, false],
    ['author publishes', author, PUBLISHED, false, false],
    ['admin publishes', admin, PUBLISHED, false, false],
  ];

  it.each(cases)('%s', (_desc, actor, to, assigned, allowed) => {
    const post = { createdById: author.id, status: PostStatus.DRAFT };
    const reason = transitionDenialReason(actor, post, to, assigned);
    expect(reason === null).toBe(allowed);
  });

  describe('self-approval', () => {
    // E.g. a creator who wrote this post and was later promoted to
    // reviewer for the same client.
    const promotedAuthor = user(author.id, Role.REVIEWER);
    const ownPost = { createdById: author.id, status: IN_REVIEW };

    it.each([APPROVED, CHANGES_REQUESTED])(
      'blocks reviewing your own post (%s) even when assigned',
      (to) => {
        expect(transitionDenialReason(promotedAuthor, ownPost, to, true)).toBe(
          'You cannot approve or review your own post',
        );
      },
    );

    it('throws a 403 from assertCanTransition', () => {
      expect(() =>
        assertCanTransition(promotedAuthor, ownPost, APPROVED, true),
      ).toThrow(ForbiddenException);
    });
  });
});

describe('allowedTransitionsFor', () => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const post = (status: PostStatus, scheduledAt = tomorrow) => ({
    createdById: author.id,
    status,
    scheduledAt,
  });

  it('offers the author "submit" on a draft', () => {
    expect(
      allowedTransitionsFor(author, post(PostStatus.DRAFT), false),
    ).toEqual([PostStatus.IN_REVIEW]);
  });

  it('offers the assigned reviewer both review actions', () => {
    expect(
      allowedTransitionsFor(reviewer, post(PostStatus.IN_REVIEW), true),
    ).toEqual([PostStatus.APPROVED, PostStatus.CHANGES_REQUESTED]);
  });

  it('offers the author nothing while their post is in review', () => {
    expect(
      allowedTransitionsFor(author, post(PostStatus.IN_REVIEW), false),
    ).toEqual([]);
  });

  it('offers an unassigned reviewer nothing', () => {
    expect(
      allowedTransitionsFor(reviewer, post(PostStatus.IN_REVIEW), false),
    ).toEqual([]);
  });

  it('never offers PUBLISHED (only the background job publishes)', () => {
    expect(
      allowedTransitionsFor(admin, post(PostStatus.SCHEDULED), false),
    ).toEqual([]);
  });

  describe('when the scheduled time has passed', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    it('no longer offers submit, approve or schedule', () => {
      expect(
        allowedTransitionsFor(author, post(PostStatus.DRAFT, yesterday), false),
      ).toEqual([]);
      expect(
        allowedTransitionsFor(
          admin,
          post(PostStatus.APPROVED, yesterday),
          false,
        ),
      ).toEqual([]);
    });

    it('still lets the reviewer request changes, so a new time can be set', () => {
      expect(
        allowedTransitionsFor(
          reviewer,
          post(PostStatus.IN_REVIEW, yesterday),
          true,
        ),
      ).toEqual([PostStatus.CHANGES_REQUESTED]);
    });
  });
});

describe('assertChangeRequestComment', () => {
  it('accepts a comment of exactly 10 characters', () => {
    expect(() => assertChangeRequestComment('Fix typo!!')).not.toThrow();
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['9 characters', 'Fix typo!'],
    ['short text padded with spaces', '   Fix it      '],
  ])('rejects a %s comment with a 400', (_desc, comment) => {
    let error: unknown;
    try {
      assertChangeRequestComment(comment);
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({
      code: 'COMMENT_REQUIRED',
    });
  });
});
