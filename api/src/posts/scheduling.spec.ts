import { BadRequestException, ConflictException } from '@nestjs/common';
import { Platform } from '@prisma/client';
import {
  assertInFuture,
  conflictWindow,
  findConflict,
  scheduleConflictError,
  ScheduledSlot,
} from './scheduling';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const BASE = new Date('2026-10-10T10:00:00.000Z');
const at = (offsetMs: number) => new Date(BASE.getTime() + offsetMs);

// An existing post: client 1, Instagram, 10:00 UTC.
function existing(overrides: Partial<ScheduledSlot> = {}): ScheduledSlot {
  return {
    id: 1,
    clientId: 1,
    platform: Platform.INSTAGRAM,
    scheduledAt: BASE,
    ...overrides,
  };
}

// A new post (no id yet) for the same client and platform.
function newPost(offsetMs: number) {
  return {
    clientId: 1,
    platform: Platform.INSTAGRAM,
    scheduledAt: at(offsetMs),
  };
}

describe('findConflict', () => {
  it('flags a post 1h59m after an existing one', () => {
    const result = findConflict(newPost(HOUR + 59 * MINUTE), [existing()]);
    expect(result?.id).toBe(1);
  });

  it('flags a post 1h59m before an existing one', () => {
    const result = findConflict(newPost(-(HOUR + 59 * MINUTE)), [existing()]);
    expect(result?.id).toBe(1);
  });

  it('flags a post at exactly the same time', () => {
    expect(findConflict(newPost(0), [existing()])?.id).toBe(1);
  });

  it('allows a post exactly 2 hours after', () => {
    expect(findConflict(newPost(2 * HOUR), [existing()])).toBeUndefined();
  });

  it('allows a post exactly 2 hours before', () => {
    expect(findConflict(newPost(-2 * HOUR), [existing()])).toBeUndefined();
  });

  it('ignores posts on a different platform', () => {
    const other = existing({ platform: Platform.FACEBOOK });
    expect(findConflict(newPost(30 * MINUTE), [other])).toBeUndefined();
  });

  it('ignores posts for a different client', () => {
    const other = existing({ clientId: 2 });
    expect(findConflict(newPost(30 * MINUTE), [other])).toBeUndefined();
  });

  it('does not conflict with itself when a post is being edited', () => {
    const editing = { ...newPost(30 * MINUTE), id: 1 };
    expect(findConflict(editing, [existing()])).toBeUndefined();
  });

  it('returns the closest post when several conflict', () => {
    const candidates = [
      existing({ id: 1, scheduledAt: at(-90 * MINUTE) }),
      existing({ id: 2, scheduledAt: at(20 * MINUTE) }),
      existing({ id: 3, scheduledAt: at(60 * MINUTE) }),
    ];
    expect(findConflict(newPost(0), candidates)?.id).toBe(2);
  });

  it('returns undefined when there are no other posts', () => {
    expect(findConflict(newPost(0), [])).toBeUndefined();
  });
});

describe('conflictWindow', () => {
  it('spans 2 hours either side of the time', () => {
    expect(conflictWindow(BASE)).toEqual({
      gt: at(-2 * HOUR),
      lt: at(2 * HOUR),
    });
  });
});

describe('scheduleConflictError', () => {
  it('is a 409 that includes the conflicting post id', () => {
    const error = scheduleConflictError(existing({ id: 12 }));

    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toMatchObject({
      code: 'SCHEDULE_CONFLICT',
      conflictingPostId: 12,
    });
    expect(error.message).toContain('Post #12');
  });
});

describe('assertInFuture', () => {
  const now = BASE;

  it('accepts a time one minute from now', () => {
    expect(() => assertInFuture(at(MINUTE), now)).not.toThrow();
  });

  it('rejects a time in the past', () => {
    expect(() => assertInFuture(at(-MINUTE), now)).toThrow(BadRequestException);
  });

  it('rejects the current time', () => {
    expect(() => assertInFuture(at(0), now)).toThrow(
      'Scheduled time must be in the future',
    );
  });
});
