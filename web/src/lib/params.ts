// Helpers for values that come from the URL, which users can edit by hand.

// "/posts/12" -> 12; "/posts/abc" or "/posts/-1" -> undefined
export function parseId(value: string | undefined | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined
  const id = Number(value)
  return id > 0 ? id : undefined
}

// A real calendar date in the form YYYY-MM-DD ("2026-02-31" is rejected).
export function isIsoDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}
