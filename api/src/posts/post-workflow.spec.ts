import { BadRequestException } from '@nestjs/common';
import { PostStatus } from '@prisma/client';
import {
  assertTransition,
  isEditable,
  isTransitionAllowed,
} from './post-workflow';

const { DRAFT, IN_REVIEW, CHANGES_REQUESTED, APPROVED, SCHEDULED, PUBLISHED } =
  PostStatus;

// Written out by hand from the brief, on purpose: if someone edits
// ALLOWED_TRANSITIONS by mistake, these tests should catch it.
const VALID: [PostStatus, PostStatus][] = [
  [DRAFT, IN_REVIEW],
  [IN_REVIEW, APPROVED],
  [IN_REVIEW, CHANGES_REQUESTED],
  [CHANGES_REQUESTED, IN_REVIEW],
  [APPROVED, SCHEDULED],
  [SCHEDULED, PUBLISHED],
];

const ALL_STATUSES = Object.values(PostStatus);

// Every from/to combination (36) minus the 6 valid ones.
const INVALID = ALL_STATUSES.flatMap((from) =>
  ALL_STATUSES.map((to): [PostStatus, PostStatus] => [from, to]),
).filter(([from, to]) => !VALID.some(([f, t]) => f === from && t === to));

function getError(fn: () => void): BadRequestException {
  try {
    fn();
  } catch (err) {
    return err as BadRequestException;
  }
  throw new Error('Expected function to throw');
}

describe('post workflow', () => {
  it('covers every status combination', () => {
    expect(VALID.length + INVALID.length).toBe(36);
  });

  describe('allowed transitions', () => {
    it.each(VALID)('%s → %s is allowed', (from, to) => {
      expect(isTransitionAllowed(from, to)).toBe(true);
      expect(() => assertTransition(from, to)).not.toThrow();
    });
  });

  describe('rejected transitions', () => {
    it.each(INVALID)('%s → %s is rejected with 400', (from, to) => {
      expect(isTransitionAllowed(from, to)).toBe(false);

      const error = getError(() => assertTransition(from, to));
      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getStatus()).toBe(400);
      expect(error.getResponse()).toMatchObject({
        code: 'INVALID_TRANSITION',
      });
    });
  });

  describe('error messages', () => {
    it('does not allow skipping review', () => {
      expect(() => assertTransition(DRAFT, APPROVED)).toThrow(
        'Cannot move a post from DRAFT to APPROVED. Allowed next statuses: IN_REVIEW',
      );
    });

    it('does not allow going backwards', () => {
      expect(() => assertTransition(APPROVED, DRAFT)).toThrow(
        'Allowed next statuses: SCHEDULED',
      );
    });

    it('lists both options when a post is in review', () => {
      expect(() => assertTransition(IN_REVIEW, SCHEDULED)).toThrow(
        'Allowed next statuses: APPROVED, CHANGES_REQUESTED',
      );
    });

    it('treats moving to the same status as invalid', () => {
      expect(() => assertTransition(DRAFT, DRAFT)).toThrow(
        'Cannot move a post from DRAFT to DRAFT',
      );
    });

    it('treats PUBLISHED as a final status', () => {
      expect(() => assertTransition(PUBLISHED, SCHEDULED)).toThrow(
        'PUBLISHED is a final status',
      );
    });
  });

  describe('isEditable', () => {
    it.each([DRAFT, CHANGES_REQUESTED])('%s is editable', (status) => {
      expect(isEditable(status)).toBe(true);
    });

    it.each([IN_REVIEW, APPROVED, SCHEDULED, PUBLISHED])(
      '%s is not editable',
      (status) => {
        expect(isEditable(status)).toBe(false);
      },
    );
  });
});
