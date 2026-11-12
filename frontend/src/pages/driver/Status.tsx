import { useQuery } from '@tanstack/react-query';
import { evaluateMaintenance, getMaintenanceStatus } from '../../api/fleet';
import { useSession } from '../../auth/SessionProvider';
import { DriverPage, useMyVehicleGate } from '../../components/DriverPage';
import { RetryAlert, Spinner, StatusBadge } from '../../components/ui';
import { formatDateOnly } from '../../lib/dates';
import { formatDistance } from '../../lib/format';

const ORDER: Record<string, number> = { Overdue: 0, Replace: 0, Warning: 1, 'No Data': 2, Good: 3 };

export function Status() {
  const { gate } = useMyVehicleGate();
  return <DriverPage title="Maintenance">{gate ?? <StatusList />}</DriverPage>;
}

function StatusList() {
  const { session } = useSession();
  const unit = session?.organization.distance_unit ?? 'km';
  // Same queries as Home: re-check first so time-based alerts are current
  const evaluation = useQuery({ queryKey: ['maintenance-evaluate'], queryFn: evaluateMaintenance, staleTime: 60_000 });
  const statuses = useQuery({
    queryKey: ['maintenance-status'],
    queryFn: getMaintenanceStatus,
    enabled: evaluation.isSuccess || evaluation.isError,
  });

  if (statuses.error) return <RetryAlert message={statuses.error.message} onRetry={() => void statuses.refetch()} />;
  if (!statuses.data) return <div className="flex justify-center py-12"><Spinner /></div>;

  const rows = [...statuses.data].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9));
  const overdue = rows.filter((r) => ORDER[r.status] === 0).length;
  const dueSoon = rows.filter((r) => r.status === 'Warning').length;
  const good = rows.filter((r) => r.status === 'Good').length;

  if (rows.length === 0) {
    return <p className="text-sm text-stone-500">No maintenance tasks are set up for this vehicle yet.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-500">{`${overdue} overdue · ${dueSoon} due soon · ${good} good`}</p>
      <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
        {rows.map((r) => (
          <li key={r.schedule_id} data-testid="status-item" className="flex items-start justify-between gap-3 px-4 py-3.5">
            <div className="min-w-0">
              <p data-testid="task-name" className="font-medium text-ink">{r.task}</p>
              <p className="text-sm text-stone-500">
                {r.distance_since != null && `${formatDistance(r.distance_since, unit)} since last service · `}
                {r.last_service_date ? `Last done ${formatDateOnly(r.last_service_date).split(', ')[1]}` : 'Never done'}
              </p>
            </div>
            <span className="shrink-0 pt-0.5"><StatusBadge status={r.status} /></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
