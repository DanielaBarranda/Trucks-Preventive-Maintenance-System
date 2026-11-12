import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Expense, MaintenanceStatusRow, Vehicle } from '../../api/types';
import { todayLocal } from '../../lib/dates';
import { driverSession, me } from '../../test/fixtures';
import { mockFetch, type MockResponse, type MockRoutes } from '../../test/mockFetch';
import { renderApp } from '../../test/render';

const isuzu: Vehicle = {
  id: 1, name: 'Isuzu Forward', plate_number: 'NWL-1001', vehicle_type_id: 1, vehicle_type: 'Truck',
  assigned_driver_id: 3, assigned_driver_name: 'Ben Cruz', is_active: true,
};

const row = (schedule_id: number, task: string, status: MaintenanceStatusRow['status']): MaintenanceStatusRow => ({
  vehicle_id: 1, plate_number: 'NWL-1001', schedule_id, task,
  last_service_date: null, last_service_reading: null, current_reading: 16000,
  distance_since: 16000, months_since: 0, status,
});

const statusRows = [row(1, 'Brake check', 'Good'), row(2, 'Oil change', 'Overdue')];

const expense: Expense = {
  id: 1, vehicle_id: 1, driver_id: 3, schedule_id: 2, expense_date: '2026-11-12T00:00:00',
  category: 'Maintenance', amount: 3500, notes: null, created_at: '2026-11-12T03:00:00',
};

function routes(post: (body: unknown) => MockResponse = () => ({ status: 201, json: { id: 5 } }), list: Expense[] = []): MockRoutes {
  return {
    'GET /api/auth/me': () => me(driverSession),
    'GET /api/vehicles/mine': () => ({ json: isuzu }),
    'GET /api/expenses': () => ({ json: list }),
    'POST /api/expenses': post,
    'GET /api/maintenance/status': () => ({ json: statusRows }),
    'POST /api/maintenance/evaluate': () => ({ json: { new_alerts: 0 } }),
  };
}

const posts = (spy: ReturnType<typeof mockFetch>) =>
  spy.mock.calls.filter(([url, init]) => String(url) === '/api/expenses' && init?.method === 'POST');

const jpg = (name: string) => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], name, { type: 'image/jpeg' });

async function fillValidForm() {
  await userEvent.click(await screen.findByRole('button', { name: 'Fuel' }));
  await userEvent.type(screen.getByLabelText('Amount'), '1250.50');
  await userEvent.upload(screen.getByLabelText('Work photo'), jpg('work.jpg'));
  await userEvent.upload(screen.getByLabelText('Receipt photo'), jpg('receipt.jpg'));
}

describe('expense list', () => {
  it('shows date, category, amount, linked task and receipt link', async () => {
    mockFetch(routes(undefined, [expense]));
    renderApp('/driver/expenses');
    const item = await screen.findByTestId('expense-1');
    expect(item).toHaveTextContent('Thu, Nov 12');
    expect(item).toHaveTextContent('Maintenance');
    expect(item).toHaveTextContent('₱3,500.00');
    expect(item).toHaveTextContent('Oil change');
    expect(within(item).getByRole('link', { name: 'Receipt' })).toHaveAttribute('href', '/api/expenses/1/photos/receipt');
  });

  it('empty list says so', async () => {
    mockFetch(routes());
    renderApp('/driver/expenses');
    expect(await screen.findByText('No expenses yet')).toBeInTheDocument();
  });
});

describe('new expense', () => {
  it('shows the six category chips; Other asks what it was', async () => {
    mockFetch(routes());
    renderApp('/driver/expenses/new');
    for (const name of ['Fuel', 'Maintenance', 'Parts', 'Toll', 'Parking', 'Other']) {
      expect(await screen.findByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.queryByLabelText('What was it?')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Other' }));
    expect(screen.getByRole('button', { name: 'Other' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('What was it?')).toBeInTheDocument();
  });

  it('requires a category, an amount above 0 and both photos', async () => {
    const spy = mockFetch(routes());
    renderApp('/driver/expenses/new');
    await userEvent.click(await screen.findByRole('button', { name: 'Save expense' }));
    expect(await screen.findByText('Pick a category')).toBeInTheDocument();
    expect(screen.getByText('Enter the amount')).toBeInTheDocument();
    expect(screen.getByText('Take a photo of the work')).toBeInTheDocument();
    expect(screen.getByText('Take a photo of the receipt')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Amount'), '0');
    await userEvent.click(screen.getByRole('button', { name: 'Save expense' }));
    expect(await screen.findByText('Enter an amount above 0')).toBeInTheDocument();
    expect(posts(spy)).toHaveLength(0);
  });

  it('picking a maintenance task sets the category to Maintenance; urgent tasks first', async () => {
    mockFetch(routes());
    renderApp('/driver/expenses/new');
    const select = await screen.findByLabelText('For a maintenance task? (optional)');
    await screen.findByRole('option', { name: /Oil change/ });
    const options = within(select).getAllByRole('option').map((o) => o.textContent);
    expect(options[1]).toMatch(/Oil change/);
    await userEvent.selectOptions(select, '2');
    expect(screen.getByRole('button', { name: 'Maintenance' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('sends the form with both photos and returns home', async () => {
    const spy = mockFetch(routes());
    renderApp('/driver/expenses/new');
    await fillValidForm();
    await userEvent.type(screen.getByLabelText('Notes (optional)'), 'Shell, full tank');
    await userEvent.click(screen.getByRole('button', { name: 'Save expense' }));

    expect(await screen.findByText('Expense saved')).toBeInTheDocument();
    expect(posts(spy)).toHaveLength(1);
    const body = posts(spy)[0][1]?.body;
    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;
    expect(form.get('expense_date')).toBe(todayLocal());
    expect(form.get('category')).toBe('Fuel');
    expect(form.get('amount')).toBe('1250.50');
    expect(form.get('notes')).toBe('Shell, full tank');
    expect(form.has('schedule_id')).toBe(false);
    expect((form.get('process_photo') as File).name).toBe('work.jpg');
    expect((form.get('receipt_photo') as File).name).toBe('receipt.jpg');
  });

  it('sends schedule_id when a task is linked', async () => {
    const spy = mockFetch(routes());
    renderApp('/driver/expenses/new');
    await fillValidForm();
    await screen.findByRole('option', { name: /Oil change/ });
    await userEvent.selectOptions(screen.getByLabelText('For a maintenance task? (optional)'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Save expense' }));
    await screen.findByText('Expense saved');
    const form = posts(spy)[0][1]?.body as FormData;
    expect(form.get('schedule_id')).toBe('2');
    expect(form.get('category')).toBe('Maintenance');
  });

  it('keeps everything when the upload fails, and a second tap re-sends', async () => {
    let fail = true;
    const spy = mockFetch(routes(() => (fail ? { networkError: true } : { status: 201, json: { id: 5 } })));
    renderApp('/driver/expenses/new');
    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: 'Save expense' }));
    expect(await screen.findByText('Upload failed. Check your signal and tap Save again.')).toBeInTheDocument();
    expect(screen.getByAltText('Work photo preview')).toBeInTheDocument();
    expect(screen.getByAltText('Receipt photo preview')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount')).toHaveValue('1250.50');

    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Save expense' }));
    expect(await screen.findByText('Expense saved')).toBeInTheDocument();
    expect(posts(spy)).toHaveLength(2);
  });

  it('after a lost response, Save again does not create a duplicate when the first one was saved', async () => {
    let saved: Expense[] = [];
    const spy = mockFetch({
      ...routes(() => {
        // The server saves it, but the answer never reaches the phone
        saved = [{ ...expense, id: 9, schedule_id: null, category: 'Fuel', amount: 1250.5,
          expense_date: `${todayLocal()}T00:00:00`, created_at: new Date().toISOString().slice(0, 19) }];
        return { networkError: true };
      }),
      'GET /api/expenses': () => ({ json: saved }),
    });
    renderApp('/driver/expenses/new');
    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: 'Save expense' }));
    expect(await screen.findByText('Upload failed. Check your signal and tap Save again.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save expense' }));
    expect(await screen.findByText('Expense saved')).toBeInTheDocument();
    expect(posts(spy)).toHaveLength(1);
  });

  it('shows Uploading… and is disabled while sending', async () => {
    const spy = mockFetch(routes(() => ({ status: 201, json: { id: 5 }, delay: 300 })));
    renderApp('/driver/expenses/new');
    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: 'Save expense' }));
    const busy = await screen.findByRole('button', { name: /Uploading…/ });
    expect(busy).toBeDisabled();
    await userEvent.click(busy);
    expect(await screen.findByText('Expense saved')).toBeInTheDocument();
    expect(posts(spy)).toHaveLength(1);
  });
});
