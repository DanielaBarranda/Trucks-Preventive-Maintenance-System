import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { evaluateMaintenance, getFleetOverview, getMaintenanceStatus, getMonthlyExpenses, getNotifications } from '../../api/fleet';
import type { MaintenanceStatusRow } from '../../api/types';
import { useSession } from '../../auth/SessionProvider';
import { Card, cx, RetryAlert, Spinner, StatusBadge } from '../../components/ui';
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
  const overdue = rows.filter((r) => r.status === 'Overdue' || r.status === 'Replace').length;
  const dueSoon = rows.filter((r) => r.status === 'Warning').length;

  return (
    <AdminLayout>
      <div data-testid="page-admin-dashboard" className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
            {greeting(now)}, {firstName(session?.user.full_name ?? '')}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {error ? (
          <RetryAlert message={error.message} onRetry={() => { void fleet.refetch(); void statuses.refetch(); }} />
        ) : loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-stone-200 bg-white lg:grid-cols-4">
              <Tile className="border-b border-r lg:border-b-0" testId="tile-vehicles" label="Vehicles" value={fleet.data?.length ?? 0} note="in your fleet" />
              <Tile className="border-b lg:border-b-0 lg:border-r" testId="tile-overdue" label="Overdue" value={overdue} tone={overdue > 0 ? 'text-red-600' : undefined} note="needs service now" />
              <Tile className="border-r" testId="tile-due-soon" label="Due soon" value={dueSoon} tone={dueSoon > 0 ? 'text-amber-600' : undefined} note="coming up next" />
              <Tile
                testId="tile-spent"
                label="Spent this month"
                value={expenses.isError ? '—' : expenses.isPending ? '…' : formatMoney(spent, currency)}
                note={expenses.isError ? "Couldn't load expenses" : now.toLocaleDateString(undefined, { month: 'long' })}
                noteTone={expenses.isError ? 'text-red-600' : undefined}
              />
            </div>

            {fleet.data?.length === 0 ? (
              <Card className="py-14 text-center">
                <h2 className="font-display text-lg font-semibold text-ink">No vehicles yet</h2>
                <p className="mt-1 text-sm text-stone-500">Adding vehicles and drivers is coming soon.</p>
              </Card>
            ) : (
              <div className="grid items-start gap-6 lg:grid-cols-5">
                <Panel className="lg:col-span-3" title="Needs attention" count={attention.length}>
                  {attention.length === 0 ? (
                    <p className="flex items-center gap-2 px-5 py-6 text-sm text-stone-600">
                      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-green-600" />
                      All maintenance is up to date.
                    </p>
                  ) : (
                    <ul className="divide-y divide-stone-100">
                      {attention.slice(0, 8).map((r) => <AttentionItem key={`${r.vehicle_id}-${r.schedule_id}`} row={r} />)}
                    </ul>
                  )}
                </Panel>
                <Panel className="lg:col-span-2" title="Latest alerts">
                  {alerts.isPending ? (
                    <div className="px-5 py-6"><Spinner small /></div>
                  ) : alerts.isError ? (
                    <div className="p-4"><RetryAlert message={alerts.error.message} onRetry={() => void alerts.refetch()} /></div>
                  ) : (alerts.data ?? []).length === 0 ? (
                    <p className="px-5 py-6 text-sm text-stone-500">No unread alerts.</p>
                  ) : (
                    <ul className="divide-y divide-stone-100">
                      {(alerts.data ?? []).slice(0, 5).map((n) => (
                        <li key={n.id} className="px-5 py-3 text-sm">
                          <p className="text-stone-800">{n.message}</p>
                          <p className="mt-0.5 text-xs text-stone-400">{timeAgo(n.created_at)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}

function Tile({ testId, label, value, tone, note, noteTone, className }: {
  testId: string; label: string; value: ReactNode; tone?: string; note?: string; noteTone?: string; className?: string;
}) {
  return (
    <div className={cx('border-stone-200 px-5 py-4', className)}>
      <div data-testid={testId}>
        <p className="text-xs font-medium text-stone-500">{label}</p>
        <p className={cx('num mt-2 truncate text-2xl font-semibold sm:text-3xl', tone ?? 'text-ink')}>{value}</p>
      </div>
      {note && <p className={cx('mt-1 truncate text-xs', noteTone ?? 'text-stone-400')}>{note}</p>}
    </div>
  );
}

function Panel({ title, count, className, children }: { title: string; count?: number; className?: string; children: ReactNode }) {
  return (
    <section className={cx('overflow-hidden rounded-xl border border-stone-200 bg-white', className)}>
      <h2 className="flex items-center gap-2 border-b border-stone-200 px-5 py-3 text-sm font-semibold text-ink">
        {title}
        {!!count && <span className="num rounded-md bg-stone-100 px-1.5 text-xs font-medium text-stone-500">{count}</span>}
      </h2>
      {children}
    </section>
  );
}

function AttentionItem({ row }: { row: MaintenanceStatusRow }) {
  return (
    <li data-testid="attention-item" className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
      <span className="min-w-0 truncate">
        <span className="font-medium text-ink">{row.plate_number}</span>
        <span className="text-stone-500"> · {row.task}</span>
      </span>
      <StatusBadge status={row.status} />
    </li>
  );
}
