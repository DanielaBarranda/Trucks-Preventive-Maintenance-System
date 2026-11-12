// Behaviour when the server is unreachable or a call fails (final-review fixes)
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Vehicle } from './api/types';
import { driverSession, me, ownerSession } from './test/fixtures';
import { mockFetch, type MockRoutes } from './test/mockFetch';
import { renderApp } from './test/render';

const ownerDashboard: MockRoutes = {
  'GET /api/auth/me': () => me(ownerSession),
  'POST /api/maintenance/evaluate': () => ({ json: { new_alerts: 0 } }),
  'GET /api/reports/fleet-overview': () => ({ json: [] }),
  'GET /api/maintenance/status': () => ({ json: [] }),
  'GET /api/notifications': () => ({ json: [] }),
  'GET /api/reports/monthly-expenses': () => ({ json: [] }),
};

it('startup with the server unreachable shows a retry screen, not the login page', async () => {
  let up = false;
  mockFetch({ ...ownerDashboard, 'GET /api/auth/me': () => (up ? me(ownerSession) : { networkError: true }) });
  renderApp('/admin');

  expect(await screen.findByText(/can't reach the server/i)).toBeInTheDocument();
  expect(screen.queryByTestId('page-login')).not.toBeInTheDocument();

  up = true;
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByTestId('page-admin-dashboard')).toBeInTheDocument();
});

it('startup server error (500) also shows the retry screen', async () => {
  mockFetch({ 'GET /api/auth/me': () => ({ status: 500, json: { title: 'An error occurred while processing your request.' } }) });
  renderApp('/admin');
  expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
  expect(screen.queryByTestId('page-login')).not.toBeInTheDocument();
});

it('dashboard: failed expenses call shows a dash, not a fake zero', async () => {
  mockFetch({ ...ownerDashboard, 'GET /api/reports/monthly-expenses': () => ({ status: 500, json: { title: 'Server error' } }) });
  renderApp('/admin');
  const tile = await screen.findByTestId('tile-spent');
  expect(await within(tile).findByText('—')).toBeInTheDocument();
  expect(within(tile).queryByText(/0\.00/)).not.toBeInTheDocument();
});

it('dashboard: failed alerts call shows the error, not "No unread alerts"', async () => {
  mockFetch({
    ...ownerDashboard,
    'GET /api/reports/fleet-overview': () => ({ json: [{ vehicle_id: 1, vehicle_name: 'T', plate_number: 'P-1', vehicle_type: 'Truck',
      assigned_driver_name: null, latest_reading: null, total_expenses: null, min_expense: null, max_expense: null,
      expense_count: 0, last_expense_date: null, open_alerts: 0, unread_notifications: 0, last_trip_at: null }] }),
    'GET /api/notifications': () => ({ status: 500, json: { message: 'Alerts are unavailable right now.' } }),
  });
  renderApp('/admin');
  expect(await screen.findByText('Alerts are unavailable right now.')).toBeInTheDocument();
  expect(screen.queryByText('No unread alerts.')).not.toBeInTheDocument();
});

it('dashboard: a failed logout is reported and the user stays signed in', async () => {
  mockFetch({ ...ownerDashboard, 'POST /api/auth/logout': () => ({ networkError: true }) });
  renderApp('/admin');
  await screen.findByTestId('page-admin-dashboard');
  await userEvent.click(screen.getAllByRole('button', { name: 'Log out' })[0]);
  expect(await screen.findByText(/couldn't log out/i)).toBeInTheDocument();
  expect(screen.getByTestId('page-admin-dashboard')).toBeInTheDocument();
});

it('driver home: connection error offers retry and recovers', async () => {
  let up = false;
  const isuzu: Vehicle = { id: 1, name: 'Isuzu Forward', plate_number: 'NWL-1001', vehicle_type_id: 1, vehicle_type: 'Truck',
    assigned_driver_id: 3, assigned_driver_name: 'Ben Cruz', is_active: true };
  mockFetch({
    'GET /api/auth/me': () => me(driverSession),
    'GET /api/vehicles/mine': () => (up ? { json: isuzu } : { networkError: true }),
    'POST /api/maintenance/evaluate': () => ({ json: { new_alerts: 0 } }),
    'GET /api/maintenance/status': () => ({ json: [] }),
  });
  renderApp('/driver');
  expect(await screen.findByText(/can't reach the server/i)).toBeInTheDocument();
  up = true;
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Isuzu Forward')).toBeInTheDocument();
});
