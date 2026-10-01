import type { Platform } from './types'

// Same limits and counting as api/src/posts/caption-limits.ts. The server
// is the real check; this copy only powers the live counter in the editor.
export const CAPTION_LIMITS: Record<Platform, number> = {
  X: 280,
  INSTAGRAM: 2200,
  LINKEDIN: 3000,
  FACEBOOK: 5000,
}

// Counts code points, so an emoji counts as 1 character (as on the API).
export function captionLength(caption: string): number {
  return [...caption].length
}
