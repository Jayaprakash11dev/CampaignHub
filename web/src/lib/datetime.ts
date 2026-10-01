import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

// The API stores and returns every time in UTC. The agency works in India,
// so everything shown on screen is converted to IST here.
export const IST = 'Asia/Kolkata'

export function formatIst(iso: string, format = 'D MMM YYYY, h:mm A'): string {
  return dayjs(iso).tz(IST).format(format)
}

export { dayjs }
