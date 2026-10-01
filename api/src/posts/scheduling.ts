import { BadRequestException, ConflictException } from '@nestjs/common';
import { Platform } from '@prisma/client';

// Two posts for the same client on the same platform must be at least
// this far apart.
export const MIN_GAP_MS = 2 * 60 * 60 * 1000;

export interface ScheduledSlot {
  id: number;
  clientId: number;
  platform: Platform;
  scheduledAt: Date;
}

// `id` is missing when the post is being created.
export type ScheduleTarget = Omit<ScheduledSlot, 'id'> & { id?: number };

// The open interval around a time where another post would conflict.
// Both bounds are exclusive, so a post exactly 2 hours away is fine.
// The service passes this straight into the Prisma query, so the database
// check and findConflict() always agree on what a conflict is.
export function conflictWindow(scheduledAt: Date): { gt: Date; lt: Date } {
  const time = scheduledAt.getTime();
  return {
    gt: new Date(time - MIN_GAP_MS),
    lt: new Date(time + MIN_GAP_MS),
  };
}

// Returns the closest post that is too near the target, or undefined.
// Post status is deliberately ignored: any post holding a slot counts.
export function findConflict(
  target: ScheduleTarget,
  candidates: ScheduledSlot[],
): ScheduledSlot | undefined {
  const targetTime = target.scheduledAt.getTime();
  let closest: ScheduledSlot | undefined;
  let closestGap = Infinity;

  for (const candidate of candidates) {
    if (
      candidate.id === target.id ||
      candidate.clientId !== target.clientId ||
      candidate.platform !== target.platform
    ) {
      continue;
    }
    const gap = Math.abs(candidate.scheduledAt.getTime() - targetTime);
    if (gap < MIN_GAP_MS && gap < closestGap) {
      closest = candidate;
      closestGap = gap;
    }
  }

  return closest;
}

export function scheduleConflictError(
  conflicting: ScheduledSlot,
): ConflictException {
  return new ConflictException({
    statusCode: 409,
    error: 'Conflict',
    code: 'SCHEDULE_CONFLICT',
    message: `Post #${conflicting.id} for this client on ${conflicting.platform} is scheduled within 2 hours of this time`,
    conflictingPostId: conflicting.id,
  });
}

// `now` is a parameter so tests don't depend on the real clock.
export function assertInFuture(scheduledAt: Date, now: Date = new Date()) {
  if (scheduledAt.getTime() > now.getTime()) {
    return;
  }
  throw new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    code: 'SCHEDULED_IN_PAST',
    message: 'Scheduled time must be in the future',
  });
}
