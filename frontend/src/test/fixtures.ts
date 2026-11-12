import type { Session } from '../api/types';

const northwind = { id: 1, name: 'Northwind Logistics', currency_code: 'PHP', distance_unit: 'km' as const };

export const ownerSession: Session = {
  user: { id: 1, full_name: 'Nina Reyes', email: 'owner@northwind.demo', role: 'Owner', must_change_password: false },
  organization: northwind,
  permissions: ['drivers.manage', 'vehicles.manage', 'schedules.manage', 'reports.view', 'alerts.manage', 'org.manage', 'admins.manage'],
};

export const adminSession: Session = {
  user: { id: 2, full_name: 'Arnel Santos', email: 'admin@northwind.demo', role: 'Admin', must_change_password: false },
  organization: northwind,
  permissions: ['drivers.manage', 'vehicles.manage', 'schedules.manage', 'reports.view', 'alerts.manage'],
};

export const driverSession: Session = {
  user: { id: 3, full_name: 'Ben Cruz', email: 'driver1@northwind.demo', role: 'Driver', must_change_password: false },
  organization: northwind,
  permissions: ['logs.submit'],
};

export const mustChangeSession: Session = {
  ...adminSession,
  user: { ...adminSession.user, must_change_password: true },
};

// /api/auth/me response body for a session
export const me = (s: Session) => ({ json: { success: true, message: 'OK', ...s } });
