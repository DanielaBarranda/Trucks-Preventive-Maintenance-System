import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { evaluateMaintenance, getMaintenanceStatus, getMyVehicle } from '../../api/fleet';
import { useSession } from '../../auth/SessionProvider';
import { NoVehicleCard } from '../../components/DriverPage';
import { Alert, buttonClass, cx, RetryAlert, Spinner, StatusBadge } from '../../components/ui';
import { DriverLayout } from '../../layouts/DriverLayout';
import { firstName, formatDistance } from '../../lib/format';

const URGENT = ['Overdue', 'Replace'];

function currencySymbol(currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}

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
          <>
            <section className="rounded-2xl border border-stone-200 bg-white p-5">
              <p className="text-xs font-medium text-stone-500">Your vehicle</p>
              <p className="mt-1 font-medium text-ink">{vehicle.data.name}</p>
              <p className="text-sm text-stone-500">{vehicle.data.plate_number}</p>
              <div className="mt-5 border-t border-stone-100 pt-4">
                <p className="text-xs font-medium text-stone-500">Odometer</p>
                <p className="num mt-1 text-4xl font-semibold text-ink">{formatDistance(latest, unit)}</p>
              </div>
            </section>

            {statuses.isPending ? (
              <div className="flex justify-center py-4"><Spinner small /></div>
            ) : statuses.error ? (
              <RetryAlert message={statuses.error.message} onRetry={() => void statuses.refetch()} />
            ) : (
              <DueCard tone={tone} tasks={due.map((d) => ({ task: d.task, status: d.status }))} />
            )}

            <div className="grid gap-2.5 pt-1">
              <Link to="/driver/odometer" className={buttonClass('primary', 'rounded-xl py-3.5 text-base')}>+ Log odometer</Link>
              <div className="grid grid-cols-2 gap-2.5">
                <Link to="/driver/trips/new" className={buttonClass('secondary', 'rounded-xl py-3.5')}>Start trip</Link>
                <Link to="/driver/expenses/new" className={buttonClass('secondary', 'rounded-xl py-3.5')}>
                  {currencySymbol(session?.organization.currency_code ?? 'PHP')} Add expense
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </DriverLayout>
  );
}

// A one-time success message passed by the page that just saved something
// (navigate('/driver', { state: { notice } })). Cleared from history so a refresh doesn't repeat it.
function useNotice(): string | null {
  const location = useLocation();
  const navigate = useNavigate();
  const [notice] = useState<string | null>(() => (location.state as { notice?: string } | null)?.notice ?? null);
  useEffect(() => {
    if ((location.state as { notice?: string } | null)?.notice) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);
  return notice;
}

const DUE_STYLES = {
  red: 'border-red-200 bg-red-50/60',
  amber: 'border-amber-200 bg-amber-50/60',
  green: 'border-stone-200 bg-white',
};

function DueCard({ tone, tasks }: { tone: keyof typeof DUE_STYLES; tasks: { task: string; status: string }[] }) {
  return (
    <section data-testid="due-card" data-tone={tone} className={cx('rounded-2xl border', DUE_STYLES[tone])}>
      {tasks.length === 0 ? (
        <p className="flex items-center gap-2 px-5 py-4 text-sm text-stone-700">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-green-600" />
          All maintenance is up to date
        </p>
      ) : (
        <>
          <p className={cx('px-5 pt-4 text-sm font-semibold', tone === 'red' ? 'text-red-800' : 'text-amber-800')}>
            {tasks.length} task{tasks.length > 1 ? 's' : ''} need{tasks.length > 1 ? '' : 's'} attention
          </p>
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
