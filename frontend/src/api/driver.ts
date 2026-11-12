import { apiFetch } from './client';
import type { Expense, NewTrip, OdometerReading, Trip } from './types';

// Calls a driver makes for their own assigned vehicle

export const getReadings = () => apiFetch<OdometerReading[]>('/api/odometer-readings');

export const addReading = (reading: number) =>
  apiFetch<{ id: number; new_alerts: number }>('/api/odometer-readings', { method: 'POST', json: { reading } });

export const getTrips = () => apiFetch<Trip[]>('/api/trips');

export const createTrip = (trip: NewTrip) =>
  apiFetch<{ id: number }>('/api/trips', { method: 'POST', json: trip });

export const departTrip = (id: number) => apiFetch<boolean>(`/api/trips/${id}/depart`, { method: 'PUT' });

export const arriveTrip = (id: number) => apiFetch<boolean>(`/api/trips/${id}/arrive`, { method: 'PUT' });

export const getExpenses = () => apiFetch<Expense[]>('/api/expenses');

// Multipart: the browser sets the Content-Type boundary itself
export const createExpense = (form: FormData) =>
  apiFetch<{ id: number }>('/api/expenses', { method: 'POST', body: form });

export const expensePhotoUrl = (id: number, kind: 'process' | 'receipt') => `/api/expenses/${id}/photos/${kind}`;
