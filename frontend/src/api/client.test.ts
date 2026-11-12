import { vi } from 'vitest';
import { mockFetch } from '../test/mockFetch';
import { ApiError, apiFetch, setUnauthorizedHandler } from './client';
import { login } from './auth';
import { getMyVehicle } from './fleet';

afterEach(() => setUnauthorizedHandler(() => {}));

it('apiFetch returns parsed JSON and sends credentials', async () => {
  const spy = mockFetch({ 'GET /api/vehicles': () => ({ json: [{ id: 1 }] }) });
  const data = await apiFetch<{ id: number }[]>('/api/vehicles');
  expect(data).toEqual([{ id: 1 }]);
  expect(spy).toHaveBeenCalledWith('/api/vehicles', expect.objectContaining({ credentials: 'include' }));
});

it('apiFetch sends JSON bodies', async () => {
  const spy = mockFetch({ 'POST /api/things': (body) => ({ json: body }) });
  const echoed = await apiFetch('/api/things', { method: 'POST', json: { a: 1 } });
  expect(echoed).toEqual({ a: 1 });
  const init = spy.mock.calls[0][1] as RequestInit;
  expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
});

it('apiFetch throws ApiError with server message', async () => {
  mockFetch({ 'POST /api/drivers': () => ({ status: 409, json: { message: 'Email is already registered.' } }) });
  const error = await apiFetch<never>('/api/drivers', { method: 'POST', json: {} }).catch((e: ApiError) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error.status).toBe(409);
  expect(error.message).toBe('Email is already registered.');
});

it('apiFetch calls unauthorized handler on 401', async () => {
  const handler = vi.fn();
  setUnauthorizedHandler(handler);
  mockFetch({
    'GET /api/vehicles': () => ({ status: 401 }),
    'POST /api/auth/login': () => ({ status: 401 }),
  });

  await expect(apiFetch('/api/vehicles')).rejects.toBeInstanceOf(ApiError);
  expect(handler).toHaveBeenCalledTimes(1);

  await expect(apiFetch('/api/auth/login', { method: 'POST', json: {} })).rejects.toBeInstanceOf(ApiError);
  expect(handler).toHaveBeenCalledTimes(1);   // not for login attempts
});

it('startup session check (401 from /api/auth/me) does not trigger the unauthorized handler', async () => {
  const handler = vi.fn();
  setUnauthorizedHandler(handler);
  mockFetch({ 'GET /api/auth/me': () => ({ status: 401 }) });
  await expect(apiFetch('/api/auth/me')).rejects.toBeInstanceOf(ApiError);
  expect(handler).not.toHaveBeenCalled();   // "not logged in" is normal, not an expired session
});

it('network failure becomes ApiError status 0', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  const error = await apiFetch<never>('/api/vehicles').catch((e: ApiError) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error.status).toBe(0);
  expect(error.message).toBe("Can't reach the server.");
});

it('login throws when success is false', async () => {
  mockFetch({ 'POST /api/auth/login': () => ({ json: { success: false, message: 'Invalid email or password' } }) });
  await expect(login('a@b.c', 'x')).rejects.toMatchObject({ status: 401, message: 'Invalid email or password' });
});

it('getMyVehicle returns null on 404', async () => {
  mockFetch({ 'GET /api/vehicles/mine': () => ({ status: 404, json: { message: 'No vehicle is assigned to you.' } }) });
  expect(await getMyVehicle()).toBeNull();
});
