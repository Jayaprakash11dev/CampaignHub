import { BadRequestException } from '@nestjs/common';
import { Platform } from '@prisma/client';
import { assertCaptionFits, captionLength } from './caption-limits';

// Limits from the brief, written out here instead of imported.
const LIMITS: [Platform, number][] = [
  [Platform.X, 280],
  [Platform.INSTAGRAM, 2200],
  [Platform.LINKEDIN, 3000],
  [Platform.FACEBOOK, 5000],
];

describe('caption limits', () => {
  it.each(LIMITS)('%s accepts exactly %i characters', (platform, limit) => {
    expect(() => assertCaptionFits(platform, 'a'.repeat(limit))).not.toThrow();
  });

  it.each(LIMITS)(
    '%s rejects %i + 1 characters with a 400',
    (platform, limit) => {
      let error: unknown;
      try {
        assertCaptionFits(platform, 'a'.repeat(limit + 1));
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'CAPTION_TOO_LONG',
        limit,
        length: limit + 1,
      });
    },
  );

  it('explains the limit in the error message', () => {
    expect(() => assertCaptionFits(Platform.X, 'a'.repeat(301))).toThrow(
      'X captions can be at most 280 characters (currently 301)',
    );
  });

  it('allows a long caption on Facebook that would be too long for X', () => {
    const caption = 'a'.repeat(1000);
    expect(() => assertCaptionFits(Platform.FACEBOOK, caption)).not.toThrow();
    expect(() => assertCaptionFits(Platform.X, caption)).toThrow();
  });

  describe('captionLength', () => {
    it('counts an emoji as one character', () => {
      expect('🚀'.length).toBe(2); // what plain JS would say
      expect(captionLength('🚀')).toBe(1);
      expect(captionLength('Launch day 🚀🎉')).toBe(13);
    });

    it('does not let emoji push a caption over the limit unfairly', () => {
      const caption = '🚀'.repeat(280);
      expect(() => assertCaptionFits(Platform.X, caption)).not.toThrow();
    });
  });
});
