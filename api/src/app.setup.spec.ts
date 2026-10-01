import { parseCorsOrigins } from './app.setup';

describe('parseCorsOrigins', () => {
  it('allows any origin when not configured', () => {
    expect(parseCorsOrigins(undefined)).toBe(true);
    expect(parseCorsOrigins('')).toBe(true);
    expect(parseCorsOrigins(' , ')).toBe(true);
  });

  it('returns the listed origins, trimmed and without a trailing slash', () => {
    expect(
      parseCorsOrigins(
        ' https://campaignhub.vercel.app/ , http://localhost:5173',
      ),
    ).toEqual(['https://campaignhub.vercel.app', 'http://localhost:5173']);
  });
});
