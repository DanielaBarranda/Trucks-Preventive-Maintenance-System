import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Trip, Vehicle } from '../../api/types';
import { todayLocal } from '../../lib/dates';
import { driverSession, me } from '../../test/fixtures';
import { mockFetch, type MockResponse, type MockRoutes } from '../../test/mockFetch';
import { renderApp } from '../../test/render';

const isuzu: Vehicle = {
  id: 1, name: 'Isuzu Forward', plate_number: 'NWL-1001', vehicle_type_id: 1, vehicle_type: 'Truck',
  assigned_driver_id: 3, assigned_driver_name: 'Ben Cruz', is_active: true,
};

const trip = (id: number, destination: string, departed_at: string | null, arrived_at: string | null): Trip => ({
  id, vehicle_id: 1, driver_id: 3, driver_name: 'Ben Cruz', trip_date: '2026-11-12T00:00:00',
  pickup_location: 'Main depot', pickup_address: '12 Pier Rd', destination,
  scheduled_time: '08:30:00', departed_at, arrived_at,
});

function routes(trips: Trip[], overrides: Partial<MockRoutes> = {}): MockRoutes {
  return {
    'GET /api/auth/me': () => me(driverSession),
    'GET /api/vehicles/mine': () => ({ json: isuzu }),
    'GET /api/trips': () => ({ json: trips }),
    ...overrides,
  } as MockRoutes;
}

const calls = (spy: ReturnType<typeof mockFetch>, method: string, path: string) =>
  spy.mock.calls.filter(([url, init]) => String(url) === path && (init?.method ?? 'GET') === method);

it('groups trips: on the road, planned, done', async () => {
  mockFetch(routes([
    trip(1, 'Cebu port', '2026-11-12T00:00:00', '2026-11-12T03:00:00'),
    trip(2, 'Mandaue yard', null, null),
    trip(3, 'Lapu-Lapu', '2026-11-12T04:00:00', null),
  ]));
  renderApp('/driver/trips');
  const headings = await screen.findAllByRole('heading', { level: 2 });
  expect(headings.map((h) => h.textContent)).toEqual(['On the road', 'Planned', 'Done']);

  const road = screen.getByTestId('trip-3');
  expect(within(road).getByRole('button', { name: 'Mark arrived' })).toBeInTheDocument();
  const planned = screen.getByTestId('trip-2');
  expect(within(planned).getByRole('button', { name: 'Mark departed' })).toBeInTheDocument();
  const done = screen.getByTestId('trip-1');
  expect(within(done).queryByRole('button')).not.toBeInTheDocument();
  expect(done).toHaveTextContent(/Departed .*Arrived/);
});

it('Mark departed moves the trip to on the road', async () => {
  let departed: string | null = null;
  const spy = mockFetch(routes([], {
    'GET /api/trips': () => ({ json: [trip(3, 'Lapu-Lapu', departed, null)] }),
    'PUT /api/trips/3/depart': () => { departed = '2026-11-12T04:00:00'; return { json: true }; },
  }));
  renderApp('/driver/trips');
  await userEvent.click(await screen.findByRole('button', { name: 'Mark departed' }));
  expect(await screen.findByRole('button', { name: 'Mark arrived' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'On the road' })).toBeInTheDocument();
  expect(calls(spy, 'PUT', '/api/trips/3/depart')).toHaveLength(1);
});

it('a failed action shows the server message on that trip', async () => {
  mockFetch(routes([trip(3, 'Lapu-Lapu', null, null)], {
    'PUT /api/trips/3/depart': () => ({ status: 400, json: { message: 'This trip has already departed.' } }),
  }));
  renderApp('/driver/trips');
  await userEvent.click(await screen.findByRole('button', { name: 'Mark departed' }));
  expect(await within(screen.getByTestId('trip-3')).findByText('This trip has already departed.')).toBeInTheDocument();
});

it('empty list offers a new trip', async () => {
  mockFetch(routes([]));
  renderApp('/driver/trips');
  expect(await screen.findByText('No trips yet')).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: '+ New trip' })[0]).toHaveAttribute('href', '/driver/trips/new');
});

describe('new trip', () => {
  const post = (status = 201): MockResponse => ({ status, json: { id: 7 } });

  it('requires pickup place, address and destination', async () => {
    const spy = mockFetch(routes([], { 'POST /api/trips': () => post() }));
    renderApp('/driver/trips/new');
    await userEvent.click(await screen.findByRole('button', { name: 'Add trip' }));
    expect(await screen.findByText('Enter the pickup place')).toBeInTheDocument();
    expect(screen.getByText('Enter the pickup address')).toBeInTheDocument();
    expect(screen.getByText('Enter the destination')).toBeInTheDocument();
    expect(calls(spy, 'POST', '/api/trips')).toHaveLength(0);
  });

  it('date defaults to today and the trip is posted', async () => {
    const spy = mockFetch(routes([], { 'POST /api/trips': () => post() }));
    renderApp('/driver/trips/new');
    expect(await screen.findByLabelText('Date')).toHaveValue(todayLocal());
    await userEvent.type(screen.getByLabelText('Pickup place'), 'Main depot');
    await userEvent.type(screen.getByLabelText('Pickup address'), '12 Pier Rd');
    await userEvent.type(screen.getByLabelText('Destination'), 'Cebu port');
    await userEvent.click(screen.getByRole('button', { name: 'Add trip' }));

    expect(await screen.findByText('Trip added')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Trips' })).toBeInTheDocument();
    const [, init] = calls(spy, 'POST', '/api/trips')[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      trip_date: todayLocal(), pickup_location: 'Main depot', pickup_address: '12 Pier Rd', destination: 'Cebu port',
    });
  });

  it('sends the scheduled time when given', async () => {
    const spy = mockFetch(routes([], { 'POST /api/trips': () => post() }));
    renderApp('/driver/trips/new');
    await userEvent.type(await screen.findByLabelText('Pickup place'), 'Main depot');
    await userEvent.type(screen.getByLabelText('Pickup address'), '12 Pier Rd');
    await userEvent.type(screen.getByLabelText('Destination'), 'Cebu port');
    await userEvent.type(screen.getByLabelText('Time (optional)'), '08:30');
    await userEvent.click(screen.getByRole('button', { name: 'Add trip' }));
    await screen.findByText('Trip added');
    const [, init] = calls(spy, 'POST', '/api/trips')[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({ scheduled_time: '08:30' });
  });
});
