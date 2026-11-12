import { act, screen } from '@testing-library/react';
import { apiFetch } from '../api/client';
import { driverSession, me, mustChangeSession, ownerSession } from '../test/fixtures';
import { mockFetch } from '../test/mockFetch';
import { renderApp } from '../test/render';
import { homePathFor } from './guards';

const anonymous = { 'GET /api/auth/me': () => ({ status: 401 }) };

it('homePathFor picks the area from permissions', () => {
  expect(homePathFor(ownerSession)).toBe('/admin');
  expect(homePathFor(driverSession)).toBe('/driver');
  expect(homePathFor(mustChangeSession)).toBe('/change-password');
});

it('anonymous user opening /admin is sent to /login', async () => {
  mockFetch(anonymous);
  renderApp('/admin');
  expect(await screen.findByTestId('page-login')).toBeInTheDocument();
});

it('logged-in owner opening /login lands on /admin', async () => {
  mockFetch({ 'GET /api/auth/me': () => me(ownerSession) });
  renderApp('/login');
  expect(await screen.findByTestId('page-admin-dashboard')).toBeInTheDocument();
});

it('logged-in driver opening /login lands on /driver', async () => {
  mockFetch({ 'GET /api/auth/me': () => me(driverSession) });
  renderApp('/login');
  expect(await screen.findByTestId('page-driver-home')).toBeInTheDocument();
});

it('driver visiting /admin lands on /driver', async () => {
  mockFetch({ 'GET /api/auth/me': () => me(driverSession) });
  renderApp('/admin');
  expect(await screen.findByTestId('page-driver-home')).toBeInTheDocument();
  expect(screen.queryByTestId('page-admin-dashboard')).not.toBeInTheDocument();
});

it('owner visiting /driver lands on /admin', async () => {
  mockFetch({ 'GET /api/auth/me': () => me(ownerSession) });
  renderApp('/driver');
  expect(await screen.findByTestId('page-admin-dashboard')).toBeInTheDocument();
});

it('must-change user is redirected to change password', async () => {
  mockFetch({ 'GET /api/auth/me': () => me(mustChangeSession) });
  renderApp('/admin');
  expect(await screen.findByTestId('page-change-password')).toBeInTheDocument();
});

it('401 during a page sends user to login', async () => {
  mockFetch({
    'GET /api/auth/me': () => me(ownerSession),
    'GET /api/vehicles': () => ({ status: 401 }),
  });
  renderApp('/admin');
  expect(await screen.findByTestId('page-admin-dashboard')).toBeInTheDocument();

  await act(async () => {
    await apiFetch('/api/vehicles').catch(() => {});
  });

  expect(await screen.findByTestId('page-login')).toBeInTheDocument();
});
