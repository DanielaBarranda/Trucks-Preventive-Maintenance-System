import { ApiError, apiFetch } from './client';
import type { DistanceUnit, Session } from './types';

type SessionResponse = Partial<Session> & { success: boolean; message: string };

function toSession(res: SessionResponse): Session {
  if (!res.success || !res.user || !res.organization || !res.permissions) {
    throw new ApiError(401, res.message || 'Invalid email or password');
  }
  return { user: res.user, organization: res.organization, permissions: res.permissions };
}

export async function getMe(): Promise<Session> {
  return toSession(await apiFetch<SessionResponse>('/api/auth/me'));
}

export async function login(email: string, password: string): Promise<Session> {
  return toSession(await apiFetch<SessionResponse>('/api/auth/login', { method: 'POST', json: { email, password } }));
}

export interface SignupInput {
  organization_name: string;
  owner_name: string;
  email: string;
  password: string;
  currency_code: string;
  distance_unit: DistanceUnit;
  template_categories: string[];
}

export async function signup(input: SignupInput): Promise<Session> {
  return toSession(await apiFetch<SessionResponse>('/api/auth/signup', { method: 'POST', json: input }));
}

export async function logout(): Promise<void> {
  await apiFetch<void>('/api/auth/logout', { method: 'POST' });
}

export async function changePassword(current_password: string, new_password: string): Promise<void> {
  await apiFetch<void>('/api/auth/change-password', { method: 'POST', json: { current_password, new_password } });
}
