import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { evaluateMaintenance, getFleetOverview, getMaintenanceStatus, getMonthlyExpenses, getNotifications } from '../../api/fleet';
import type { MaintenanceStatusRow } from '../../api/types';
import { useSession } from '../../auth/SessionProvider';
import { Card, RetryAlert, Spinner, StatusBadge } from '../../components/ui';
import { AdminLayout } from '../../layouts/AdminLayout';
import { firstName, formatMoney, greeting, timeAgo } from '../../lib/format';

const SEVERITY: Record<string, number> = { Overdue: 0, Replace: 1, Warning: 2 };

export function Dashboard() {
  const { session } = useSession();
  const now = new Date();

  // Re-check maintenance first so month-based alerts are current, then load the dashboard
  const evaluation = useQuery({ queryKey: ['maintenance-evaluate'], queryFn: evaluateMaintenance, staleTime: 60_000 });
  const ready = evaluation.isSuccess || evaluation.isError;

  const fleet = useQuery({ queryKey: ['fleet-overview'], queryFn: getFleetOverview, enabled: ready });
  const statuses = useQuery({ queryKey: ['maintenance-status'], queryFn: getMaintenanceStatus, enabled: ready });
  const alerts = useQuery({ queryKey: ['notifications', 'unread'], queryFn: () => getNotifications(true), enabled: ready });
  const expenses = useQuery({
    queryKey: ['monthly-expenses', now.getFullYear()],
    queryFn: () => getMonthlyExpenses(now.getFullYear()),
    enabled: ready,
  });

  const loading = !ready || fleet.isPending || statuses.isPending;
  const error = fleet.error ?? statuses.error;
  const rows = statuses.data ?? [];
  const attention = rows
    .filter((r) => r.status in SEVERITY)
    .sort((a, b) => SEVERITY[a.status] - SEVERITY[b.status]);
  const spent = (expenses.data ?? [])
    .filter((e) => e.month === now.getMonth() + 1)
    .reduce((sum, e) => sum + e.total, 0);
  const currency = session?.organization.currency_code ?? 'PHP';

  return (
    <AdminLayout>
      <div data-testid="page-admin-dashboard" className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {greeting(now)}, {firstName(session?.user.full_name ?? '')}
          </h1>
          <p className="text-sm text-slate-500">Here's your fleet today</p>
        </div>

        {error ? (
          <RetryAlert message={error.message} onRetry={() => { void fleet.refetch(); void statuses.refetch(); }} />
        ) : loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Tile testId="tile-vehicles" label="Vehicles" value={fleet.data?.length ?? 0} />
              <Tile testId="tile-overdue" label="Overdue" value={rows.filter((r) => r.status === 'Overdue' || r.status === 'Replace').length} tone="text-red-600" />
              <Tile testId="tile-due-soon" label="Due soon" value={rows.filter((r) => r.status === 'Warning').length} tone="text-amber-600" />
              <Tile
                testId="tile-spent"
                label="Spent this month"
                value={expenses.isError ? '—' : expenses.isPending ? '…' : formatMoney(spent, currency)}
                hint={expenses.isError ? "Couldn't load expenses" : undefined}
              />
            </div>

            {fleet.data?.length === 0 ? (
              <Card className="py-10 text-center">
                <h2 className="text-lg font-semibold text-slate-900">No vehicles yet</h2>
                <p className="mt-1 text-sm text-slate-500">Adding vehicles and drivers is coming soon.</p>
              </Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-5">
                <Card className="lg:col-span-3">
                  <h2 className="font-semibold text-slate-900">Needs attention</h2>
                  {attention.length === 0 ? (
                    <p className="mt-3 text-sm text-green-700">All maintenance is up to date.</p>
                  ) : (
                    <ul className="mt-2 divide-y divide-slate-100">
                      {attention.slice(0, 8).map((r) => <AttentionItem key={`${r.vehicle_id}-${r.schedule_id}`} row={r} />)}
                    </ul>
                  )}
                </Card>
                <Card className="lg:col-span-2">
                  <h2 className="font-semibold text-slate-900">Latest alerts</h2>
                  {alerts.isPending ? (
                    <div className="py-4"><Spinner small /></div>
                  ) : alerts.isError ? (
                    <div className="mt-3"><RetryAlert message={alerts.error.message} onRetry={() => void alerts.refetch()} /></div>
                  ) : (alerts.data ?? []).length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">No unread alerts.</p>
                  ) : (
                    <ul className="mt-2 space-y-3">
                      {(alerts.data ?? []).slice(0, 5).map((n) => (
                        <li key={n.id} className="text-sm">
                          <p className="text-slate-800">{n.message}</p>
                          <p className="text-xs text-slate-500">{timeAgo(n.created_at)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}

function Tile({ testId, label, value, tone, hint }: { testId: string; label: string; value: ReactNode; tone?: string; hint?: string }) {
  return (
    <Card>
      <div data-testid={testId}>
        <p className="text-sm text-slate-500">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${tone ?? 'text-slate-900'}`}>{value}</p>
        {hint && <p className="text-xs text-red-600">{hint}</p>}
      </div>
    </Card>
  );
}

function AttentionItem({ row }: { row: MaintenanceStatusRow }) {
  return (
    <li data-testid="attention-item" className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <span className="min-w-0 truncate">
        <span className="font-medium text-slate-800">{row.plate_number}</span>
        <span className="text-slate-500"> · {row.task}</span>
      </span>
      <StatusBadge status={row.status} />
    </li>
  );
}
