import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Vehicle } from './api/types';
import { driverSession, me } from './test/fixtures';
import { mockFetch, type MockRoutes } from './test/mockFetch';
import { renderApp } from './test/render';

const isuzu: Vehicle = {
  id: 1, name: 'Isuzu Forward', plate_number: 'NWL-1001', vehicle_type_id: 1, vehicle_type: 'Truck',
  assigned_driver_id: 3, assigned_driver_name: 'Ben Cruz', is_active: true,
};

const noVehicle = { status: 409, json: { message: 'No vehicle is assigned to you.' } };

function routes(overrides: Partial<MockRoutes> = {}): MockRoutes {
  return {
    'GET /api/auth/me': () => me(driverSession),
    'POST /api/maintenance/evaluate': () => ({ json: { new_alerts: 0 } }),
    'GET /api/vehicles/mine': () => ({ json: isuzu }),
    'GET /api/maintenance/status': () => ({ json: [] }),
    'GET /api/odometer-readings': () => ({ json: [] }),
    'GET /api/trips': () => ({ json: [] }),
    'GET /api/expenses': () => ({ json: [] }),
    ...overrides,
  } as MockRoutes;
}

it('tab bar has links to the four driver pages', async () => {
  mockFetch(routes());
  renderApp('/driver');
  const nav = await screen.findByRole('navigation', { name: 'Driver' });
  for (const name of ['Home', 'Trips', 'Expenses', 'Status']) {
    expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
  }
  expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
});

it('clicking Trips opens the trips page and marks the tab', async () => {
  mockFetch(routes());
  renderApp('/driver');
  const nav = await screen.findByRole('navigation', { name: 'Driver' });
  await userEvent.click(within(nav).getByRole('link', { name: 'Trips' }));
  expect(await screen.findByRole('heading', { name: 'Trips' })).toBeInTheDocument();
  const tabs = screen.getByRole('navigation', { name: 'Driver' });   // each page renders its own layout
  expect(within(tabs).getByRole('link', { name: 'Trips' })).toHaveAttribute('aria-current', 'page');
  expect(within(tabs).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
});

it('Home action buttons are links', async () => {
  mockFetch(routes());
  renderApp('/driver');
  expect(await screen.findByRole('link', { name: /Log odometer/ })).toHaveAttribute('href', '/driver/odometer');
  expect(screen.getByRole('link', { name: /Start trip/ })).toHaveAttribute('href', '/driver/trips/new');
  expect(screen.getByRole('link', { name: /Add expense/ })).toHaveAttribute('href', '/driver/expenses/new');
  expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
});

it('a driver with no vehicle sees the no-vehicle card on a driver page', async () => {
  mockFetch(routes({
    'GET /api/vehicles/mine': () => ({ status: 404, json: { message: 'No vehicle is assigned to you.' } }),
    'GET /api/odometer-readings': () => noVehicle,
  }));
  renderApp('/driver/odometer');
  expect(await screen.findByText(/No vehicle assigned yet/)).toBeInTheDocument();
});

it('Home shows a success notice passed in router state', async () => {
  mockFetch(routes());
  renderApp('/driver', { notice: 'Reading saved' });
  expect(await screen.findByText('Reading saved')).toBeInTheDocument();
});
