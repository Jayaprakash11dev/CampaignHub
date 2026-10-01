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

export { dayjs }
