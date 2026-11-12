export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;   // unknown currency code
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

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
