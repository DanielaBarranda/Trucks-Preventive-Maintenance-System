import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { GuestOnly, Permissions, RequireAuth, RequirePermission } from './auth/guards';
import { SessionProvider } from './auth/SessionProvider';
import { Dashboard } from './pages/admin/Dashboard';
import { Expenses } from './pages/driver/Expenses';
import { Home } from './pages/driver/Home';
import { NewExpense } from './pages/driver/NewExpense';
import { NewTrip } from './pages/driver/NewTrip';
import { Odometer } from './pages/driver/Odometer';
import { Status } from './pages/driver/Status';
import { Trips } from './pages/driver/Trips';
import { ChangePassword } from './pages/public/ChangePassword';
import { Landing } from './pages/public/Landing';
import { Login } from './pages/public/Login';
import { Signup } from './pages/public/Signup';

const driver = (page: ReactNode) => (
  <RequireAuth>
    <RequirePermission permission={Permissions.LogsSubmit}>{page}</RequirePermission>
  </RequireAuth>
);

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
        <Route path="/driver" element={driver(<Home />)} />
        <Route path="/driver/odometer" element={driver(<Odometer />)} />
        <Route path="/driver/trips" element={driver(<Trips />)} />
        <Route path="/driver/trips/new" element={driver(<NewTrip />)} />
        <Route path="/driver/expenses" element={driver(<Expenses />)} />
        <Route path="/driver/expenses/new" element={driver(<NewExpense />)} />
        <Route path="/driver/status" element={driver(<Status />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SessionProvider>
  );
}
