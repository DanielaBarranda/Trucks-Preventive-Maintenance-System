// The API sends timestamps in UTC without a zone suffix, and date-only fields as
// "YYYY-MM-DDT00:00:00". Never pass a date-only value through new Date(...): in UTC+8
// that can turn "today" into "yesterday".

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function parseServerTime(iso: string): Date {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
}

export function dateOnly(value: string): string {
  return value.slice(0, 10);
}

// "Thu, Nov 12" — built from the date's own parts, so no time-zone shift
export function formatDateOnly(value: string): string {
  const [y, m, d] = dateOnly(value).split('-').map(Number);
  const weekday = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday}, ${MONTHS[m - 1]} ${d}`;
}

// Today's date in the device's own time zone, as YYYY-MM-DD
export function todayLocal(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// "3:41 PM" in the device's zone, from a server timestamp
export function formatTime(iso: string): string {
  return parseServerTime(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
