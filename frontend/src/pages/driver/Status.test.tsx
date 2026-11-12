import { screen, within } from '@testing-library/react';
import type { MaintenanceStatusRow, Vehicle } from '../../api/types';
import { driverSession, me } from '../../test/fixtures';
import { mockFetch, type MockRoutes } from '../../test/mockFetch';
import { renderApp } from '../../test/render';

const isuzu: Vehicle = {
  id: 1, name: 'Isuzu Forward', plate_number: 'NWL-1001', vehicle_type_id: 1, vehicle_type: 'Truck',
  assigned_driver_id: 3, assigned_driver_name: 'Ben Cruz', is_active: true,
};

const row = (schedule_id: number, task: string, status: MaintenanceStatusRow['status'], last: string | null, since: number | null): MaintenanceStatusRow => ({
  vehicle_id: 1, plate_number: 'NWL-1001', schedule_id, task,
  last_service_date: last, last_service_reading: null, current_reading: 16000,
  distance_since: since, months_since: 0, status,
});

const rows = [
  row(1, 'Brakes', 'Good', '2026-11-01T00:00:00', 1200),
  row(2, 'Tires', 'No Data', null, null),
  row(3, 'Oil change', 'Warning', '2026-08-01T00:00:00', 4800),
  row(4, 'Air filter', 'Good', '2026-10-01T00:00:00', 2000),
  row(5, 'Coolant', 'Overdue', null, 16000),
  row(6, 'Battery', 'Good', '2026-09-01T00:00:00', 3000),
  row(7, 'Belts', 'Replace', '2026-01-01T00:00:00', 15000),
];

function routes(overrides: Partial<MockRoutes> = {}): MockRoutes {
  return {
    'GET /api/auth/me': () => me(driverSession),
    'GET /api/vehicles/mine': () => ({ json: isuzu }),
    'POST /api/maintenance/evaluate': () => ({ json: { new_alerts: 0 } }),
    'GET /api/maintenance/status': () => ({ json: rows }),
    ...overrides,
  } as MockRoutes;
}

it('lists every task, worst first', async () => {
  mockFetch(routes());
  renderApp('/driver/status');
  const items = await screen.findAllByTestId('status-item');
  const order = items.map((i) => within(i).getByTestId('task-name').textContent);
  expect(order.slice(0, 2).sort()).toEqual(['Belts', 'Coolant']);
  expect(order[2]).toBe('Oil change');
  expect(order[3]).toBe('Tires');
  expect(order.slice(4).sort()).toEqual(['Air filter', 'Battery', 'Brakes']);
  expect(within(items[2]).getByText('Warning')).toBeInTheDocument();
});

it('shows distance since service and when it was last done', async () => {
  mockFetch(routes());
  renderApp('/driver/status');
  await screen.findAllByTestId('status-item');
  const brakes = screen.getAllByTestId('status-item').find((i) => i.textContent?.includes('Brakes'))!;
  expect(brakes).toHaveTextContent('1,200 km since last service');
  expect(brakes).toHaveTextContent('Last done Nov 1');
  const coolant = screen.getAllByTestId('status-item').find((i) => i.textContent?.includes('Coolant'))!;
  expect(coolant).toHaveTextContent('Never done');
  expect(coolant).not.toHaveTextContent('since last service');   // there was no last service
});

it('shows a summary line', async () => {
  mockFetch(routes());
  renderApp('/driver/status');
  expect(await screen.findByText('2 overdue · 1 due soon · 3 good')).toBeInTheDocument();
});

it('shows a retry message when loading fails', async () => {
  mockFetch(routes({ 'GET /api/maintenance/status': () => ({ status: 500, json: { message: 'Server error' } }) }));
  renderApp('/driver/status');
  expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
});

it("Home's due card links to the status page", async () => {
  mockFetch(routes());
  renderApp('/driver');
  const card = await screen.findByTestId('due-card');
  expect(within(card).getByRole('link', { name: 'See all' })).toHaveAttribute('href', '/driver/status');
});
