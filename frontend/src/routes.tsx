import { Navigate, Route, Routes } from 'react-router-dom';
import { GuestOnly, Permissions, RequireAuth, RequirePermission } from './auth/guards';
import { SessionProvider } from './auth/SessionProvider';
import { Dashboard } from './pages/admin/Dashboard';
import { Placeholder } from './pages/Placeholder';
import { ChangePassword } from './pages/public/ChangePassword';
import { Landing } from './pages/public/Landing';
import { Login } from './pages/public/Login';
import { Signup } from './pages/public/Signup';

export function AppRoutes() {
  return (
    <SessionProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/signup" element={<GuestOnly><Signup /></GuestOnly>} />
        <Route
          path="/change-password"
          element={<RequireAuth><ChangePassword /></RequireAuth>}
        />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <RequirePermission permission={Permissions.ReportsView}>
                <Dashboard />
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
