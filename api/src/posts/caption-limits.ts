import { BadRequestException } from '@nestjs/common';
import { Platform } from '@prisma/client';

export const CAPTION_LIMITS: Record<Platform, number> = {
  [Platform.X]: 280,
  [Platform.INSTAGRAM]: 2200,
  [Platform.LINKEDIN]: 3000,
  [Platform.FACEBOOK]: 5000,
};

// Counts characters the way a person would: spreading the string splits it
// into Unicode code points, so an emoji like 🚀 counts as 1 instead of the
// 2 that `caption.length` (UTF-16 units) would give.
export function captionLength(caption: string): number {
  return [...caption].length;
}

export function assertCaptionFits(platform: Platform, caption: string): void {
  const limit = CAPTION_LIMITS[platform];
  const length = captionLength(caption);
  if (length <= limit) {
    return;
  }

  throw new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    code: 'CAPTION_TOO_LONG',
    message: `${platform} captions can be at most ${limit} characters (currently ${length})`,
    limit,
    length,
  });
}
