import { dateOnly, formatDateOnly, formatTime, parseServerTime, todayLocal } from './dates';

it('parseServerTime treats a zone-less timestamp as UTC', () => {
  expect(parseServerTime('2026-11-12T03:28:11').getTime()).toBe(Date.UTC(2026, 10, 12, 3, 28, 11));
});

it('parseServerTime keeps an explicit zone', () => {
  expect(parseServerTime('2026-11-12T03:28:11Z').getTime()).toBe(Date.UTC(2026, 10, 12, 3, 28, 11));
  expect(parseServerTime('2026-11-12T11:28:11+08:00').getTime()).toBe(Date.UTC(2026, 10, 12, 3, 28, 11));
});

it('dateOnly keeps the first 10 characters', () => {
  expect(dateOnly('2026-11-12T00:00:00')).toBe('2026-11-12');
  expect(dateOnly('2026-11-12')).toBe('2026-11-12');
});

it('formatDateOnly shows the calendar date without a zone shift', () => {
  const text = formatDateOnly('2026-11-12T00:00:00');
  expect(text).toContain('12');
  expect(text).toContain('Nov');
  expect(text).toContain('Thu');
});

it('todayLocal is YYYY-MM-DD for the device date', () => {
  const now = new Date();
  const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  expect(todayLocal()).toBe(expected);
});

it('formatTime shows a clock time', () => {
  expect(formatTime('2026-11-12T03:28:11')).toMatch(/\d{1,2}:28/);
});
