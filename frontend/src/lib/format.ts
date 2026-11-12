import { parseServerTime } from './dates';

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;   // unknown currency code
  }
}

// '₱' for PHP, '$' for USD; the code itself when unknown
export function currencySymbol(currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}

export function formatDistance(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) return '—';
  return `${value.toLocaleString('en-US')} ${unit}`;
}

export type Tone = 'red' | 'amber' | 'green' | 'slate';

// Red / amber / green are used ONLY for maintenance status
export function statusTone(status: string): Tone {
  switch (status) {
    case 'Overdue':
    case 'Replace':
      return 'red';
    case 'Warning':
      return 'amber';
    case 'Good':
      return 'green';
    default:
      return 'slate';
  }
}

// "just now", "5 min ago", "3 hours ago", "2 days ago"
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = parseServerTime(iso);   // API timestamps are UTC without a zone suffix
  const seconds = Math.round((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  return rtf.format(-Math.round(hours / 24), 'day');
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
