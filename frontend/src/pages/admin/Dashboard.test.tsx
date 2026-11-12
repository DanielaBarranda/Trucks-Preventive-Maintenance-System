import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FleetOverviewRow, MaintenanceStatusRow } from '../../api/types';
import { adminSession, me, ownerSession } from '../../test/fixtures';
import { mockFetch, type MockRoutes } from '../../test/mockFetch';
import { renderApp } from '../../test/render';

const now = new Date();

const vehicle = (id: number, plate: string): FleetOverviewRow => ({
  vehicle_id: id, vehicle_name: `Truck ${id}`, plate_number: plate, vehicle_type: 'Truck',
  assigned_driver_name: null, latest_reading: 16000, total_expenses: null, min_expense: null,
  max_expense: null, expense_count: 0, last_expense_date: null, open_alerts: 0,
  unread_notifications: 0, last_trip_at: null,
});

const status = (vehicleId: number, plate: string, task: string, s: MaintenanceStatusRow['status']): MaintenanceStatusRow => ({
  vehicle_id: vehicleId, plate_number: plate, schedule_id: Math.floor(Math.random() * 1e6), task,
  last_service_date: null, last_service_reading: null, current_reading: 16000,
  distance_since: 16000, months_since: 0, status: s,
});

function routes(overrides: Partial<MockRoutes> = {}, session = ownerSession): MockRoutes {
  return {
    'GET /api/auth/me': () => me(session),
    'POST /api/maintenance/evaluate': () => ({ json: { new_alerts: 0 } }),
    'GET /api/reports/fleet-overview': () => ({ json: [vehicle(1, 'NWL-1001'), vehicle(2, 'NWL-1002')] }),
    'GET /api/maintenance/status': () => ({
      json: [
        status(1, 'NWL-1001', 'Oil change', 'Warning'),
        status(1, 'NWL-1001', 'Tire check', 'Overdue'),
        status(2, 'NWL-1002', 'Brakes', 'Good'),
        status(2, 'NWL-1002', 'Coolant', 'Replace'),
      ],
    }),
    'GET /api/notifications': () => ({
      json: [{ id: 1, vehicle_id: 1, maintenance_log_id: null, type: 'Urgent', message: 'Tire check is overdue on Truck 1 (NWL-1001).',
        task: 'Tire check', is_read: false, is_resolved: false, resolved_at: null, created_at: now.toISOString() }],
    }),
    'GET /api/reports/monthly-expenses': () => ({
      json: [
        { vehicle_id: 1, plate_number: 'NWL-1001', year: now.getFullYear(), month: now.getMonth() + 1, total: 1000, min: 1000, max: 1000, count: 1 },
        { vehicle_id: 2, plate_number: 'NWL-1002', year: now.getFullYear(), month: now.getMonth() + 1, total: 500, min: 500, max: 500, count: 1 },
      ],
    }),
    ...overrides,
  } as MockRoutes;
}

it('shows summary tiles from API data', async () => {
  mockFetch(routes());
  renderApp('/admin');
  expect(await within(await screen.findByTestId('tile-vehicles')).findByText('2')).toBeInTheDocument();
  expect(within(screen.getByTestId('tile-overdue')).getByText('2')).toBeInTheDocument();    // Overdue + Replace
  expect(within(screen.getByTestId('tile-due-soon')).getByText('1')).toBeInTheDocument();   // Warning
  expect(within(screen.getByTestId('tile-spent')).getByText(/1,500\.00/)).toBeInTheDocument();
});

it('lists needs-attention items worst first', async () => {
  mockFetch(routes());
  renderApp('/admin');
  const items = await screen.findAllByTestId('attention-item');
  expect(items.map((i) => i.textContent)).toEqual([
    expect.stringContaining('Tire check'),
    expect.stringContaining('Coolant'),
    expect.stringContaining('Oil change'),
  ]);
  expect(screen.queryByText('Brakes')).not.toBeInTheDocument();
});

it('calls evaluate on load and shows latest alerts', async () => {
  const spy = mockFetch(routes());
  renderApp('/admin');
  expect(await screen.findByText('Tire check is overdue on Truck 1 (NWL-1001).')).toBeInTheDocument();
  expect(spy.mock.calls.some(([url, init]) => String(url) === '/api/maintenance/evaluate' && init?.method === 'POST')).toBe(true);
});

it('greets the user by first name', async () => {
  mockFetch(routes());
  renderApp('/admin');
  expect(await screen.findByText(/, Nina$/)).toBeInTheDocument();
});

it('empty organization shows empty state', async () => {
  mockFetch(routes({
    'GET /api/reports/fleet-overview': () => ({ json: [] }),
    'GET /api/maintenance/status': () => ({ json: [] }),
    'GET /api/notifications': () => ({ json: [] }),
    'GET /api/reports/monthly-expenses': () => ({ json: [] }),
  }));
  renderApp('/admin');
  expect(await screen.findByText('No vehicles yet')).toBeInTheDocument();
  expect(within(screen.getByTestId('tile-vehicles')).getByText('0')).toBeInTheDocument();
});

it('hides Admins and Settings without permissions', async () => {
  mockFetch(routes({}, adminSession));
  renderApp('/admin');
  await screen.findByTestId('page-admin-dashboard');
  expect(screen.queryByRole('link', { name: /Admins/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Settings/ })).not.toBeInTheDocument();
});

it('shows Admins and Settings to the owner', async () => {
  mockFetch(routes());
  renderApp('/admin');
  await screen.findByTestId('page-admin-dashboard');
  expect(screen.getAllByText('Admins').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Settings').length).toBeGreaterThan(0);
});

it('log out returns to the landing page', async () => {
  mockFetch(routes({ 'POST /api/auth/logout': () => ({ status: 204 }) }));
  renderApp('/admin');
  await screen.findByTestId('page-admin-dashboard');
  await userEvent.click(screen.getAllByRole('button', { name: 'Log out' })[0]);
  expect(await screen.findByTestId('page-landing')).toBeInTheDocument();
});
