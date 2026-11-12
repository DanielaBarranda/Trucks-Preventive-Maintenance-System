import { screen } from '@testing-library/react';
import type { MaintenanceStatusRow, Vehicle } from '../../api/types';
import { driverSession, me } from '../../test/fixtures';
import { mockFetch, type MockRoutes } from '../../test/mockFetch';
import { renderApp } from '../../test/render';

const isuzu: Vehicle = {
  id: 1, name: 'Isuzu Forward', plate_number: 'NWL-1001', vehicle_type_id: 1, vehicle_type: 'Truck',
  assigned_driver_id: 3, assigned_driver_name: 'Ben Cruz', is_active: true,
};

const row = (task: string, status: MaintenanceStatusRow['status']): MaintenanceStatusRow => ({
  vehicle_id: 1, plate_number: 'NWL-1001', schedule_id: task.length, task,
  last_service_date: null, last_service_reading: null, current_reading: 16000,
  distance_since: 16000, months_since: 0, status,
});

function routes(overrides: Partial<MockRoutes> = {}): MockRoutes {
  return {
    'GET /api/auth/me': () => me(driverSession),
    'POST /api/maintenance/evaluate': () => ({ json: { new_alerts: 0 } }),
    'GET /api/vehicles/mine': () => ({ json: isuzu }),
    'GET /api/maintenance/status': () => ({ json: [row('Tire check', 'Overdue'), row('Oil change', 'Warning'), row('Brakes', 'Good')] }),
    ...overrides,
  } as MockRoutes;
}

it('shows assigned vehicle and latest reading', async () => {
  mockFetch(routes());
  renderApp('/driver');
  expect(await screen.findByText('Isuzu Forward')).toBeInTheDocument();
  expect(await screen.findByText('NWL-1001')).toBeInTheDocument();
  expect(await screen.findByText('16,000 km')).toBeInTheDocument();
  expect(screen.getByText(/Hi Ben/)).toBeInTheDocument();
});

it('lists overdue tasks in red card', async () => {
  mockFetch(routes());
  renderApp('/driver');
  const card = await screen.findByTestId('due-card');
  expect(card).toHaveAttribute('data-tone', 'red');
  expect(card).toHaveTextContent('Tire check');
  expect(card).toHaveTextContent('Oil change');
  expect(card).not.toHaveTextContent('Brakes');
});

it('all good shows up-to-date message', async () => {
  mockFetch(routes({ 'GET /api/maintenance/status': () => ({ json: [row('Brakes', 'Good')] }) }));
  renderApp('/driver');
  const card = await screen.findByTestId('due-card');
  expect(card).toHaveAttribute('data-tone', 'green');
  expect(card).toHaveTextContent('All maintenance is up to date');
});

it('shows no-vehicle message', async () => {
  mockFetch(routes({
    'GET /api/vehicles/mine': () => ({ status: 404, json: { message: 'No vehicle is assigned to you.' } }),
    'GET /api/maintenance/status': () => ({ status: 409, json: { message: 'No vehicle is assigned to you.' } }),
    'POST /api/maintenance/evaluate': () => ({ status: 409, json: { message: 'No vehicle is assigned to you.' } }),
  }));
  renderApp('/driver');
  expect(await screen.findByText(/No vehicle assigned yet/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Log odometer/ })).not.toBeInTheDocument();
});

