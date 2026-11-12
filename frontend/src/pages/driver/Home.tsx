import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { evaluateMaintenance, getMaintenanceStatus, getMyVehicle } from '../../api/fleet';
import { useSession } from '../../auth/SessionProvider';
import { NoVehicleCard, useNotice } from '../../components/DriverPage';
import { Alert, buttonClass, cx, RetryAlert, Spinner, StatusBadge } from '../../components/ui';
import { DriverLayout } from '../../layouts/DriverLayout';
import { currencySymbol, firstName, formatDistance } from '../../lib/format';

const URGENT = ['Overdue', 'Replace'];

export function Home() {
  const { session } = useSession();
  const notice = useNotice();
  const vehicle = useQuery({ queryKey: ['my-vehicle'], queryFn: getMyVehicle });
  const hasVehicle = !!vehicle.data;

  // Re-check this vehicle's maintenance, then load its status
  const evaluation = useQuery({ queryKey: ['maintenance-evaluate'], queryFn: evaluateMaintenance, enabled: hasVehicle, staleTime: 60_000 });
  const statuses = useQuery({
    queryKey: ['maintenance-status'],
    queryFn: getMaintenanceStatus,
    enabled: hasVehicle && (evaluation.isSuccess || evaluation.isError),
  });

  const unit = session?.organization.distance_unit ?? 'km';
  const rows = statuses.data ?? [];
  const due = rows
    .filter((r) => r.status === 'Warning' || URGENT.includes(r.status))
    .sort((a, b) => Number(URGENT.includes(b.status)) - Number(URGENT.includes(a.status)));  // overdue first
  const latest = rows.reduce<number | null>((max, r) => (r.current_reading != null && (max == null || r.current_reading > max) ? r.current_reading : max), null);
  const tone = due.some((r) => URGENT.includes(r.status)) ? 'red' : due.length ? 'amber' : 'green';

  return (
    <DriverLayout>
      <div data-testid="page-driver-home" className="space-y-5">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
            Hi {firstName(session?.user.full_name ?? '')}
          </h1>
          <p className="text-sm text-stone-500">{session?.organization.name}</p>
        </div>

        {notice && <Alert tone="success">{notice}</Alert>}

        {vehicle.isPending ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : vehicle.error ? (
          <RetryAlert message={vehicle.error.message} onRetry={() => void vehicle.refetch()} />
        ) : !vehicle.data ? (
          <NoVehicleCard />
        ) : (
          // Phone: vehicle, due tasks, buttons. Desktop: vehicle + buttons left, due tasks right.
          <div className="space-y-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-6 lg:gap-y-5 lg:space-y-0">
            <section className="rounded-2xl border border-stone-200 bg-white p-5 lg:col-start-1">
              <p className="text-xs font-medium text-stone-500">Your vehicle</p>
              <p className="mt-1 font-medium text-ink">{vehicle.data.name}</p>
              <p className="text-sm text-stone-500">{vehicle.data.plate_number}</p>
              <div className="mt-5 border-t border-stone-100 pt-4">
                <p className="text-xs font-medium text-stone-500">Odometer</p>
                <p className="num mt-1 text-4xl font-semibold text-ink">{formatDistance(latest, unit)}</p>
              </div>
            </section>

            <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
              {statuses.isPending ? (
                <div className="flex justify-center py-4"><Spinner small /></div>
              ) : statuses.error ? (
                <RetryAlert message={statuses.error.message} onRetry={() => void statuses.refetch()} />
              ) : (
                <DueCard tone={tone} tasks={due.map((d) => ({ task: d.task, status: d.status }))} />
              )}
            </div>

            <div className="grid gap-2.5 pt-1 lg:col-start-1 lg:pt-0">
              <Link to="/driver/odometer" className={buttonClass('primary', 'rounded-xl py-3.5 text-base')}>+ Log odometer</Link>
              <div className="grid grid-cols-2 gap-2.5">
                <Link to="/driver/trips/new" className={buttonClass('secondary', 'rounded-xl py-3.5')}>Start trip</Link>
                <Link to="/driver/expenses/new" className={buttonClass('secondary', 'rounded-xl py-3.5')}>
                  {currencySymbol(session?.organization.currency_code ?? 'PHP')} Add expense
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </DriverLayout>
  );
}

const DUE_STYLES = {
  red: 'border-red-200 bg-red-50/60',
  amber: 'border-amber-200 bg-amber-50/60',
  green: 'border-stone-200 bg-white',
};

function DueCard({ tone, tasks }: { tone: keyof typeof DUE_STYLES; tasks: { task: string; status: string }[] }) {
  const seeAll = (
    <Link to="/driver/status" className="shrink-0 rounded-md py-1 text-sm font-medium text-accent-700 hover:text-accent-800">See all</Link>
  );
  return (
    <section data-testid="due-card" data-tone={tone} className={cx('rounded-2xl border', DUE_STYLES[tone])}>
      {tasks.length === 0 ? (
        <div className="flex items-center justify-between gap-2 px-5 py-4 text-sm text-stone-700">
          <p className="flex items-center gap-2">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-green-600" />
            All maintenance is up to date
          </p>
          {seeAll}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 px-5 pt-4">
            <p className={cx('text-sm font-semibold', tone === 'red' ? 'text-red-800' : 'text-amber-800')}>
              {tasks.length} task{tasks.length > 1 ? 's' : ''} need{tasks.length > 1 ? '' : 's'} attention
            </p>
            {seeAll}
          </div>
          <ul className="mt-2 divide-y divide-stone-900/5 px-5 pb-2">
            {tasks.map((t) => (
              <li key={t.task} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-stone-800">{t.task}</span>
                <StatusBadge status={t.status} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
