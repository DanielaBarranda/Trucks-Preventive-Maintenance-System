import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { expensePhotoUrl, getExpenses } from '../../api/driver';
import { getMaintenanceStatus } from '../../api/fleet';
import { useSession } from '../../auth/SessionProvider';
import { DriverPage, useMyVehicleGate } from '../../components/DriverPage';
import { buttonClass, RetryAlert, Spinner } from '../../components/ui';
import { formatDateOnly } from '../../lib/dates';
import { formatMoney } from '../../lib/format';

export function Expenses() {
  const { gate } = useMyVehicleGate();
  const add = <Link to="/driver/expenses/new" className={buttonClass('secondary', 'min-h-11 rounded-xl')}>+ Add</Link>;
  return (
    <DriverPage title="Expenses" action={gate ? undefined : add}>
      {gate ?? <ExpenseList />}
    </DriverPage>
  );
}

function ExpenseList() {
  const { session } = useSession();
  const currency = session?.organization.currency_code ?? 'PHP';
  const expenses = useQuery({ queryKey: ['expenses'], queryFn: getExpenses });
  const statuses = useQuery({ queryKey: ['maintenance-status'], queryFn: getMaintenanceStatus });   // task names

  if (expenses.isPending) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (expenses.error) return <RetryAlert message={expenses.error.message} onRetry={() => void expenses.refetch()} />;

  if (expenses.data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 px-6 py-10 text-center">
        <p className="font-medium text-ink">No expenses yet</p>
        <p className="mt-1 text-sm text-stone-500">Add fuel, tolls, parts and repairs with a photo of the receipt.</p>
        <Link to="/driver/expenses/new" className={buttonClass('primary', 'mt-5 min-h-11 rounded-xl')}>+ Add expense</Link>
      </div>
    );
  }

  const taskName = (scheduleId: number | null) =>
    scheduleId == null ? null : statuses.data?.find((r) => r.schedule_id === scheduleId)?.task ?? null;

  return (
    <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
      {expenses.data.map((e) => {
        const task = taskName(e.schedule_id);
        return (
          <li key={e.id} data-testid={`expense-${e.id}`} className="flex items-start justify-between gap-3 px-4 py-3.5">
            <div className="min-w-0">
              <p className="font-medium text-ink">{e.category}</p>
              <p className="truncate text-sm text-stone-500">
                {formatDateOnly(e.expense_date)}{task && ` · ${task}`}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="num font-semibold text-ink">{formatMoney(e.amount, currency)}</p>
              <a href={expensePhotoUrl(e.id, 'receipt')} target="_blank" rel="noreferrer" className="text-xs text-accent-700 underline decoration-accent-200 underline-offset-2">
                Receipt
              </a>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
