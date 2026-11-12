import { useQuery } from '@tanstack/react-query';
import { evaluateMaintenance, getMaintenanceStatus, getMyVehicle } from '../../api/fleet';
import { useSession } from '../../auth/SessionProvider';
import { Alert, Button, Card, Spinner } from '../../components/ui';
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
  const due = rows.filter((r) => r.status === 'Warning' || URGENT.includes(r.status));
  const latest = rows.reduce<number | null>((max, r) => (r.current_reading != null && (max == null || r.current_reading > max) ? r.current_reading : max), null);
  const tone = due.some((r) => URGENT.includes(r.status)) ? 'red' : due.length ? 'amber' : 'green';

  return (
    <DriverLayout>
      <div data-testid="page-driver-home" className="space-y-4">
        <p className="text-slate-600">Hi {firstName(session?.user.full_name ?? '')} 👋</p>

        {vehicle.isPending ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : vehicle.error ? (
          <Alert tone="error">{vehicle.error.message}</Alert>
        ) : !vehicle.data ? (
          <Card className="text-center">
            <p className="font-semibold text-slate-800">No vehicle assigned yet.</p>
            <p className="mt-1 text-sm text-slate-500">Ask your admin to assign one to you.</p>
          </Card>
        ) : (
          <>
            <Card className="bg-white">
              <p className="text-lg font-semibold text-slate-900">{vehicle.data.name}</p>
              <p className="text-sm text-slate-500">
                {vehicle.data.plate_number} · {formatDistance(latest, unit)}
              </p>
            </Card>

            {statuses.isPending ? (
              <div className="flex justify-center py-4"><Spinner small /></div>
            ) : statuses.error ? (
              <Alert tone="error">{statuses.error.message}</Alert>
            ) : (
              <DueCard tone={tone} tasks={due.map((d) => `${d.task} (${d.status.toLowerCase()})`)} />
            )}

            <div className="grid gap-3">
              <Button disabled className="py-3 text-base">+ Log odometer</Button>
              <Button disabled variant="secondary" className="py-3 text-base">▶ Start trip</Button>
              <Button disabled variant="secondary" className="py-3 text-base">
                {currencySymbol(session?.organization.currency_code ?? 'PHP')} Add expense
              </Button>
              <p className="text-center text-xs text-slate-500">Logging readings, trips and expenses is coming soon.</p>
            </div>
          </>
        )}
      </div>
    </DriverLayout>
  );
}

const DUE_STYLES = {
  red: 'border-red-200 bg-red-50 text-red-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  green: 'border-green-200 bg-green-50 text-green-800',
};

function DueCard({ tone, tasks }: { tone: keyof typeof DUE_STYLES; tasks: string[] }) {
  return (
    <div data-testid="due-card" data-tone={tone} className={`rounded-lg border p-3 ${DUE_STYLES[tone]}`}>
      {tasks.length === 0 ? (
        <p className="font-semibold">All maintenance is up to date ✓</p>
      ) : (
        <>
          <p className="font-semibold">{tasks.length} task{tasks.length > 1 ? 's' : ''} need{tasks.length > 1 ? '' : 's'} attention</p>
          <ul className="mt-1 list-inside list-disc text-sm">
            {tasks.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}
