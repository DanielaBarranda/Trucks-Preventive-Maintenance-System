import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OdometerReading, Vehicle } from '../../api/types';
import { driverSession, me } from '../../test/fixtures';
import { mockFetch, type MockResponse, type MockRoutes } from '../../test/mockFetch';
import { renderApp } from '../../test/render';

const isuzu: Vehicle = {
  id: 1, name: 'Isuzu Forward', plate_number: 'NWL-1001', vehicle_type_id: 1, vehicle_type: 'Truck',
  assigned_driver_id: 3, assigned_driver_name: 'Ben Cruz', is_active: true,
};

const reading = (id: number, value: number, day: number): OdometerReading => ({
  id, vehicle_id: 1, driver_id: 3, reading: value, recorded_at: `2026-11-${String(day).padStart(2, '0')}T03:00:00`,
});

// Newest first, as the API returns them
const history = [16000, 15400, 14800, 14100, 13500, 12900].map((v, i) => reading(10 - i, v, 10 - i));

function routes(post: (body: unknown) => MockResponse = () => ({ status: 201, json: { id: 99, new_alerts: 0 } })): MockRoutes {
  return {
    'GET /api/auth/me': () => me(driverSession),
    'GET /api/vehicles/mine': () => ({ json: isuzu }),
    'GET /api/odometer-readings': () => ({ json: history }),
    'POST /api/odometer-readings': post,
    'POST /api/maintenance/evaluate': () => ({ json: { new_alerts: 0 } }),
    'GET /api/maintenance/status': () => ({ json: [] }),
  };
}

const posts = (spy: ReturnType<typeof mockFetch>) =>
  spy.mock.calls.filter(([url, init]) => String(url).includes('/api/odometer-readings') && init?.method === 'POST');

async function type(value: string) {
  const input = await screen.findByLabelText(/New reading/);
  await userEvent.clear(input);
  await userEvent.type(input, value);
  return input;
}

it('shows the latest reading and the last 5 readings', async () => {
  mockFetch(routes());
  renderApp('/driver/odometer');
  expect(await screen.findByText('Last reading: 16,000 km')).toBeInTheDocument();
  const items = screen.getAllByTestId('reading-item');
  expect(items).toHaveLength(5);
  expect(items[0]).toHaveTextContent('16,000 km');
  expect(items[0]).toHaveTextContent('Nov 10');
});

it('blocks a reading lower than the last one', async () => {
  const spy = mockFetch(routes());
  renderApp('/driver/odometer');
  await type('15000');
  await userEvent.click(screen.getByRole('button', { name: 'Save reading' }));
  expect(await screen.findByText("Can't be lower than your last reading (16,000 km).")).toBeInTheDocument();
  expect(posts(spy)).toHaveLength(0);
});

it('saves a reading and returns home with a notice', async () => {
  const spy = mockFetch(routes());
  renderApp('/driver/odometer');
  await type('16500');
  await userEvent.click(screen.getByRole('button', { name: 'Save reading' }));
  expect(await screen.findByText('Reading saved')).toBeInTheDocument();
  expect(await screen.findByTestId('page-driver-home')).toBeInTheDocument();
  expect(posts(spy)).toHaveLength(1);
  expect(JSON.parse(String(posts(spy)[0][1]?.body))).toEqual({ reading: 16500 });
});

it('mentions new maintenance alerts in the notice', async () => {
  mockFetch(routes(() => ({ status: 201, json: { id: 99, new_alerts: 2 } })));
  renderApp('/driver/odometer');
  await type('16500');
  await userEvent.click(screen.getByRole('button', { name: 'Save reading' }));
  expect(await screen.findByText('Reading saved. 2 new maintenance alerts.')).toBeInTheDocument();
});

it('asks to confirm a jump of more than 5,000', async () => {
  const spy = mockFetch(routes());
  renderApp('/driver/odometer');
  await type('160000');
  await userEvent.click(screen.getByRole('button', { name: 'Save reading' }));
  expect(await screen.findByText("That's 144,000 km more than last time. Is it correct?")).toBeInTheDocument();
  expect(posts(spy)).toHaveLength(0);

  await userEvent.click(screen.getByRole('button', { name: 'Change it' }));
  expect(screen.queryByText(/Is it correct\?/)).not.toBeInTheDocument();
  expect(posts(spy)).toHaveLength(0);

  await userEvent.click(screen.getByRole('button', { name: 'Save reading' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Yes, save' }));
  expect(await screen.findByText('Reading saved')).toBeInTheDocument();
  expect(posts(spy)).toHaveLength(1);
});

it('shows the server message on a 400', async () => {
  mockFetch(routes(() => ({ status: 400, json: { message: "Reading can't be lower than the latest reading (16,200)." } })));
  renderApp('/driver/odometer');
  await type('16100');
  await userEvent.click(screen.getByRole('button', { name: 'Save reading' }));
  expect(await screen.findByText("Reading can't be lower than the latest reading (16,200).")).toBeInTheDocument();
});

it('keeps the typed value when the server cannot be reached', async () => {
  mockFetch(routes(() => ({ networkError: true })));
  renderApp('/driver/odometer');
  const input = await type('16500');
  await userEvent.click(screen.getByRole('button', { name: 'Save reading' }));
  expect(await screen.findByText("Can't reach the server.")).toBeInTheDocument();
  expect(input).toHaveValue('16500');
});

it('a second tap while saving does not save twice', async () => {
  const spy = mockFetch(routes(() => ({ status: 201, json: { id: 99, new_alerts: 0 }, delay: 300 })));
  renderApp('/driver/odometer');
  await type('16500');
  const button = screen.getByRole('button', { name: 'Save reading' });
  await userEvent.click(button);
  expect(button).toBeDisabled();
  await userEvent.click(button);
  expect(await screen.findByText('Reading saved')).toBeInTheDocument();
  expect(posts(spy)).toHaveLength(1);
});

it('allows any first reading when there are none yet', async () => {
  const spy = mockFetch({ ...routes(), 'GET /api/odometer-readings': () => ({ json: [] }) });
  renderApp('/driver/odometer');
  expect(await screen.findByText('First reading for this vehicle')).toBeInTheDocument();
  await type('120');
  await userEvent.click(screen.getByRole('button', { name: 'Save reading' }));
  expect(await screen.findByText('Reading saved')).toBeInTheDocument();
  expect(posts(spy)).toHaveLength(1);
});
