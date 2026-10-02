import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

// The API stores and returns every time in UTC. The agency works in India,
// so everything shown on screen is converted to IST here.
export const IST = 'Asia/Kolkata'

const INPUT_FORMAT = 'YYYY-MM-DDTHH:mm'

export function formatIst(iso: string, format = 'D MMM YYYY, h:mm A'): string {
  return dayjs(iso).tz(IST).format(format)
}

// <input type="datetime-local"> has no timezone. We always treat its value
// as IST, whatever timezone the browser is in, and send UTC to the API.

export function toIstInput(iso: string): string {
  return dayjs(iso).tz(IST).format(INPUT_FORMAT)
}

export function fromIstInput(value: string): string {
  // value is "2026-10-05T18:30", which dayjs parses without a format string
  return dayjs.tz(value, IST).toISOString()
}

export function nowIstInput(): string {
  return dayjs().tz(IST).format(INPUT_FORMAT)
}

// --- Calendar helpers. Dates are plain 'YYYY-MM-DD' strings for days in
// India, so a week never shifts because of the browser's own timezone. ---

const DATE_FORMAT = 'YYYY-MM-DD'

// Monday of the IST week containing `iso` (default: now).
export function istWeekStart(iso?: string): string {
  const day = (iso ? dayjs(iso) : dayjs()).tz(IST)
  const daysSinceMonday = (day.day() + 6) % 7 // day(): 0 = Sunday
  return addDays(day.format(DATE_FORMAT), -daysSinceMonday)
}

export function addDays(date: string, days: number): string {
  return dayjs(date).add(days, 'day').format(DATE_FORMAT)
}

// Midnight IST at the start of `date`, as a UTC ISO string for the API.
export function istDayStartUtc(date: string): string {
  return dayjs.tz(date, IST).toISOString()
}

export function isInPast(iso: string): boolean {
  return dayjs(iso).valueOf() <= dayjs().valueOf()
}

// Monday of the week containing a 'YYYY-MM-DD' date (plain date maths, no
// timezone involved).
export function mondayOf(date: string): string {
  const day = dayjs(date)
  return day.subtract((day.day() + 6) % 7, 'day').format(DATE_FORMAT)
}

// Minutes since midnight IST, e.g. 6:30 PM -> 1110. Used to place posts on
// the calendar's time grid.
export function istMinutesOfDay(iso?: string): number {
  const time = (iso ? dayjs(iso) : dayjs()).tz(IST)
  return time.hour() * 60 + time.minute()
}

// Today's date in India.
export function istToday(): string {
  return dayjs().tz(IST).format(DATE_FORMAT)
}

// The IST calendar date a UTC timestamp falls on.
export function istDate(iso: string): string {
  return formatIst(iso, DATE_FORMAT)
}

export { dayjs }
