import { Navigate, Route, Routes } from 'react-router-dom';
import { GuestOnly, Permissions, RequireAuth, RequirePermission } from './auth/guards';
import { SessionProvider } from './auth/SessionProvider';
import { Placeholder } from './pages/Placeholder';

export function AppRoutes() {
  return (
    <SessionProvider>
      <Routes>
        <Route path="/" element={<Placeholder testId="page-landing" title="FleetPMTS" />} />
        <Route path="/login" element={<GuestOnly><Placeholder testId="page-login" title="Log in" /></GuestOnly>} />
        <Route path="/signup" element={<GuestOnly><Placeholder testId="page-signup" title="Sign up" /></GuestOnly>} />
        <Route
          path="/change-password"
          element={<RequireAuth><Placeholder testId="page-change-password" title="Change password" /></RequireAuth>}
        />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <RequirePermission permission={Permissions.ReportsView}>
                <Placeholder testId="page-admin-dashboard" title="Dashboard" />
              </RequirePermission>
            </RequireAuth>
          }
        />
        <Route
          path="/driver"
          element={
            <RequireAuth>
              <RequirePermission permission={Permissions.LogsSubmit}>
                <Placeholder testId="page-driver-home" title="Driver home" />
              </RequirePermission>
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SessionProvider>
  );
}
