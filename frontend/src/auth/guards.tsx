import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Session } from '../api/types';
import { useSession } from './SessionProvider';

export const Permissions = {
  ReportsView: 'reports.view',
  LogsSubmit: 'logs.submit',
  AdminsManage: 'admins.manage',
  OrgManage: 'org.manage',
} as const;

export const can = (session: Session | null, permission: string) =>
  !!session?.permissions.includes(permission);

// Where a logged-in user belongs, based on permissions (never role names)
export function homePathFor(session: Session): string {
  if (session.user.must_change_password) return '/change-password';
  if (can(session, Permissions.ReportsView)) return '/admin';
  if (can(session, Permissions.LogsSubmit)) return '/driver';
  return '/login';
}

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" />
    </div>
  );
}

// Logged-in users only; temporary-password users must change it first
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, session } = useSession();
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner />;
  if (!session) return <Navigate to="/login" replace />;
  if (session.user.must_change_password && location.pathname !== '/change-password')
    return <Navigate to="/change-password" replace />;
  return <>{children}</>;
}

// Users without the permission are sent to their own area
export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { session } = useSession();
  if (!session) return <Navigate to="/login" replace />;
  if (!can(session, permission)) return <Navigate to={homePathFor(session)} replace />;
  return <>{children}</>;
}

// Login / sign-up pages: logged-in users go straight to their area
export function GuestOnly({ children }: { children: ReactNode }) {
  const { status, session } = useSession();
  if (status === 'loading') return <FullPageSpinner />;
  if (session) return <Navigate to={homePathFor(session)} replace />;
  return <>{children}</>;
}
