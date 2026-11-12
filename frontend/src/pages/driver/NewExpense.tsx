import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { createExpense, getExpenses } from '../../api/driver';
import { getMaintenanceStatus } from '../../api/fleet';
import { useSession } from '../../auth/SessionProvider';
import { DriverPage, useMyVehicleGate } from '../../components/DriverPage';
import { PhotoField } from '../../components/PhotoField';
import { Alert, Button, cx, Field, Input, Select } from '../../components/ui';
import { dateOnly, parseServerTime, todayLocal } from '../../lib/dates';
import { currencySymbol } from '../../lib/format';

const CATEGORIES = ['Fuel', 'Maintenance', 'Parts', 'Toll', 'Parking', 'Other'];
const SEVERITY: Record<string, number> = { Overdue: 0, Replace: 1, Warning: 2, 'No Data': 3, Good: 4 };

type Errors = Partial<Record<'category' | 'other' | 'amount' | 'date' | 'notes' | 'work' | 'receipt', string>>;

// After a lost response, the server may have saved the expense even though the phone
// saw a failure. Before sending again, look for the same expense saved in the last 10 minutes.
async function alreadySaved(form: FormData): Promise<boolean> {
  const recent = await getExpenses();
  const scheduleId = form.get('schedule_id');
  return recent.some((e) =>
    dateOnly(e.expense_date) === form.get('expense_date') &&
    e.category === form.get('category') &&
    Math.abs(e.amount - Number(form.get('amount'))) < 0.005 &&
    (e.schedule_id == null ? scheduleId === null : String(e.schedule_id) === scheduleId) &&
    Date.now() - parseServerTime(e.created_at).getTime() < 10 * 60_000);
}

export function NewExpense() {
  const { gate } = useMyVehicleGate();
  return <DriverPage title="New expense" back="/driver/expenses">{gate ?? <ExpenseForm />}</DriverPage>;
}

function ExpenseForm() {
  const { session } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const statuses = useQuery({ queryKey: ['maintenance-status'], queryFn: getMaintenanceStatus });

  const [category, setCategory] = useState<string | null>(null);
  const [other, setOther] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [notes, setNotes] = useState('');
  const [scheduleId, setScheduleId] = useState('');
  const [work, setWork] = useState<File | null>(null);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  // Unique tasks for this vehicle, the ones that need doing first
  const tasks = [...new Map((statuses.data ?? []).map((r) => [r.schedule_id, r])).values()]
    .sort((a, b) => (SEVERITY[a.status] ?? 9) - (SEVERITY[b.status] ?? 9));

  // True after a "can't reach the server" failure: the upload may still have been saved
  const [maybeSaved, setMaybeSaved] = useState(false);

  const save = useMutation({
    mutationFn: async (form: FormData) => {
      if (maybeSaved && (await alreadySaved(form))) return;
      await createExpense(form);
    },
    onError: (e) => setMaybeSaved(e instanceof ApiError && e.status === 0),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expenses'] });
      if (scheduleId) {
        void queryClient.invalidateQueries({ queryKey: ['maintenance-status'] });
        void queryClient.invalidateQueries({ queryKey: ['maintenance-evaluate'] });
      }
      navigate('/driver', { state: { notice: 'Expense saved' } });
    },
  });

  const validate = (): Errors => {
    const e: Errors = {};
    if (!category) e.category = 'Pick a category';
    if (category === 'Other' && !other.trim()) e.other = 'Say what it was';
    if (category === 'Other' && other.trim().length > 100) e.other = 'Keep it under 100 characters';
    if (!amount.trim()) e.amount = 'Enter the amount';
    else if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) e.amount = 'Enter a number like 1250.50';
    else if (Number(amount) <= 0) e.amount = 'Enter an amount above 0';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) e.date = 'Pick a date';
    else if (date > todayLocal()) e.date = "Can't be in the future";
    if (notes.length > 500) e.notes = 'Keep notes under 500 characters';
    if (!work) e.work = 'Take a photo of the work';
    if (!receipt) e.receipt = 'Take a photo of the receipt';
    return e;
  };

  const onSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    if (save.isPending) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const form = new FormData();
    form.append('expense_date', date);
    form.append('category', category === 'Other' ? other.trim() : category!);
    form.append('amount', amount.trim());
    form.append('notes', notes.trim());
    if (scheduleId) form.append('schedule_id', scheduleId);
    form.append('process_photo', work!);
    form.append('receipt_photo', receipt!);
    save.mutate(form);
  };

  const pickTask = (value: string) => {
    setScheduleId(value);
    if (value) setCategory('Maintenance');
  };

  const saveError = save.error
    ? save.error instanceof ApiError && save.error.status === 0
      ? 'Upload failed. Check your signal and tap Save again.'
      : save.error.message
    : null;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-stone-700">Category</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={cx(
                'min-h-11 rounded-full border px-4 text-sm font-medium transition-colors',
                category === c ? 'border-accent-600 bg-accent-50 text-accent-700' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300',
              )}
            >
              {c}
            </button>
          ))}
        </div>
        {errors.category && <p className="text-xs text-red-600">{errors.category}</p>}
      </fieldset>

      {category === 'Other' && (
        <Field label="What was it?" error={errors.other}>
          {(p) => <Input {...p} className="min-h-11" value={other} onChange={(e) => setOther(e.target.value)} />}
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount" error={errors.amount}>
          {(p) => (
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-stone-500">
                {currencySymbol(session?.organization.currency_code ?? 'PHP')}
              </span>
              <Input {...p} inputMode="decimal" autoComplete="off" className="num min-h-11 pl-8 text-base" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          )}
        </Field>
        <Field label="Date" error={errors.date}>
          {(p) => <Input {...p} type="date" max={todayLocal()} className="min-h-11" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
      </div>

      <Field label="For a maintenance task? (optional)" hint="Linking it marks that task as done.">
        {(p) => (
          <Select {...p} className="min-h-11" value={scheduleId} onChange={(e) => pickTask(e.target.value)}>
            <option value="">No, not for a task</option>
            {tasks.map((t) => (
              <option key={t.schedule_id} value={String(t.schedule_id)}>
                {t.task}{t.status !== 'Good' && t.status !== 'No Data' ? ` (${t.status})` : ''}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <PhotoField label="Work photo" value={work} onChange={setWork} error={errors.work} />
      <PhotoField label="Receipt photo" value={receipt} onChange={setReceipt} error={errors.receipt} />

      <Field label="Notes (optional)" error={errors.notes}>
        {(p) => <Input {...p} className="min-h-11" value={notes} onChange={(e) => setNotes(e.target.value)} />}
      </Field>

      {saveError && <Alert tone="error">{saveError}</Alert>}
      <Button type="submit" loading={save.isPending} className="min-h-12 w-full rounded-xl text-base">
        {save.isPending ? 'Uploading…' : 'Save expense'}
      </Button>
    </form>
  );
}
