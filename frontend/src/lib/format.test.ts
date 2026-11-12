import { formatDistance, formatMoney, statusTone } from './format';

it('formats distances with the unit', () => {
  expect(formatDistance(16000, 'km')).toBe('16,000 km');
  expect(formatDistance(1200, 'mi')).toBe('1,200 mi');
  expect(formatDistance(null, 'km')).toBe('—');
});

it('formats money in the organization currency', () => {
  expect(formatMoney(11770, 'PHP')).toContain('11,770.00');
  expect(formatMoney(16.75, 'USD')).toContain('16.75');
});

it('maps maintenance status to a tone', () => {
  expect(statusTone('Overdue')).toBe('red');
  expect(statusTone('Replace')).toBe('red');
  expect(statusTone('Warning')).toBe('amber');
  expect(statusTone('Good')).toBe('green');
  expect(statusTone('No Data')).toBe('slate');
});
