import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { me, mustChangeSession, ownerSession, adminSession } from '../../test/fixtures';
import { mockFetch } from '../../test/mockFetch';
import { renderApp } from '../../test/render';

const anonymous = { 'GET /api/auth/me': () => ({ status: 401 }) };

it('landing shows headline and links to signup and login', async () => {
  mockFetch(anonymous);
  renderApp('/');
  expect(await screen.findByRole('heading', { name: /never miss a maintenance date again/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Start free' })).toHaveAttribute('href', '/signup');
  expect(screen.getByRole('link', { name: 'Try the demo' })).toHaveAttribute('href', '/login');
});

it('login shows server error on bad credentials', async () => {
  mockFetch({
    ...anonymous,
    'POST /api/auth/login': () => ({ json: { success: false, message: 'Invalid email or password' } }),
  });
  renderApp('/login');
  await userEvent.type(await screen.findByLabelText('Email'), 'owner@northwind.demo');
  await userEvent.type(screen.getByLabelText('Password'), 'wrong');
  await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
  expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
});

it('login success navigates to the user home', async () => {
  mockFetch({ ...anonymous, 'POST /api/auth/login': () => me(ownerSession) });
  renderApp('/login');
  expect(await screen.findByText(/Demo: owner@northwind.demo \/ Demo1234!/)).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Email'), 'owner@northwind.demo');
  await userEvent.type(screen.getByLabelText('Password'), 'Demo1234!');
  await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
  expect(await screen.findByTestId('page-admin-dashboard')).toBeInTheDocument();
});

it('signup validates password length', async () => {
  const spy = mockFetch(anonymous);
  renderApp('/signup');
  await userEvent.type(await screen.findByLabelText('Organization name'), 'Acme');
  await userEvent.type(screen.getByLabelText('Your name'), 'Alex');
  await userEvent.type(screen.getByLabelText('Email'), 'alex@acme.test');
  await userEvent.type(screen.getByLabelText('Password'), 'short12');
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
  expect(spy.mock.calls.some(([url]) => String(url).includes('/api/auth/signup'))).toBe(false);
});

it('signup shows 409 message', async () => {
  const spy = mockFetch({
    ...anonymous,
    'POST /api/auth/signup': () => ({ status: 409, json: { message: 'Email is already registered.' } }),
  });
  renderApp('/signup');
  await userEvent.type(await screen.findByLabelText('Organization name'), 'Acme');
  await userEvent.type(screen.getByLabelText('Your name'), 'Alex');
  await userEvent.type(screen.getByLabelText('Email'), 'owner@northwind.demo');
  await userEvent.type(screen.getByLabelText('Password'), 'LongEnough1');
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByText('Email is already registered.')).toBeInTheDocument();

  const body = JSON.parse(String((spy.mock.calls.find(([u]) => String(u).includes('signup'))![1] as RequestInit).body));
  expect(body).toMatchObject({ currency_code: 'PHP', distance_unit: 'km', template_categories: ['Truck'] });
});

it('change password requires matching confirmation', async () => {
  const spy = mockFetch({ 'GET /api/auth/me': () => me(mustChangeSession) });
  renderApp('/change-password');
  await userEvent.type(await screen.findByLabelText('Current password'), 'TempPass123');
  await userEvent.type(screen.getByLabelText('New password'), 'BrandNew123');
  await userEvent.type(screen.getByLabelText('Confirm new password'), 'Different123');
  await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
  expect(await screen.findByText(/passwords don't match/i)).toBeInTheDocument();
  expect(spy.mock.calls.some(([url]) => String(url).includes('change-password'))).toBe(false);
});

it('change password success continues to the user home', async () => {
  let changed = false;
  mockFetch({
    'GET /api/auth/me': () => me(changed ? adminSession : mustChangeSession),
    'POST /api/auth/change-password': () => {
      changed = true;
      return { json: { message: 'Password changed successfully.' } };
    },
  });
  renderApp('/change-password');
  const form = within(await screen.findByTestId('page-change-password'));
  await userEvent.type(form.getByLabelText('Current password'), 'TempPass123');
  await userEvent.type(form.getByLabelText('New password'), 'BrandNew123');
  await userEvent.type(form.getByLabelText('Confirm new password'), 'BrandNew123');
  await userEvent.click(form.getByRole('button', { name: 'Change password' }));
  expect(await screen.findByTestId('page-admin-dashboard')).toBeInTheDocument();
});
