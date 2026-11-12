import { ApiError, apiFetch } from './client';
import type { FleetOverviewRow, MaintenanceStatusRow, MonthlyExpenseRow, NotificationItem, Vehicle } from './types';

export const getFleetOverview = () => apiFetch<FleetOverviewRow[]>('/api/reports/fleet-overview');

// Drivers automatically get only their own vehicle's rows
export const getMaintenanceStatus = () => apiFetch<MaintenanceStatusRow[]>('/api/maintenance/status');

// Re-checks maintenance and raises any new alerts (dashboards call this on load)
export const evaluateMaintenance = () =>
  apiFetch<{ new_alerts: number }>('/api/maintenance/evaluate', { method: 'POST' });

export const getNotifications = (unreadOnly: boolean) =>
  apiFetch<NotificationItem[]>(`/api/notifications?unread_only=${unreadOnly}`);

export const getMonthlyExpenses = (year: number) =>
  apiFetch<MonthlyExpenseRow[]>(`/api/reports/monthly-expenses?year=${year}`);

// The logged-in driver's assigned vehicle, or null when none is assigned
export async function getMyVehicle(): Promise<Vehicle | null> {
  try {
    return await apiFetch<Vehicle>('/api/vehicles/mine');
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}
