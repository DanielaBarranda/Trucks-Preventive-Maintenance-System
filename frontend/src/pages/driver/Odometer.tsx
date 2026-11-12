import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { addReading, getReadings } from '../../api/driver';
import { useSession } from '../../auth/SessionProvider';
import { DriverPage, useMyVehicleGate } from '../../components/DriverPage';
import { Button, RetryAlert, Spinner } from '../../components/ui';
import { parseServerTime } from '../../lib/dates';
import { formatDistance } from '../../lib/format';

// An increase above this (in the organization's unit) is probably a typo: ask first
const CONFIRM_ABOVE = 5000;

export function Odometer() {
  const { gate } = useMyVehicleGate();
  return <DriverPage title="Log odometer" back="/driver">{gate ?? <ReadingForm />}</DriverPage>;
}

function ReadingForm() {
  const { session } = useSession();
  const unit = session?.organization.distance_unit ?? 'km';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const readings = useQuery({ queryKey: ['odometer-readings'], queryFn: getReadings });

  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmJump, setConfirmJump] = useState<number | null>(null);

  const save = useMutation({
    mutationFn: addReading,
    onSuccess: ({ new_alerts }) => {
      for (const key of ['odometer-readings', 'maintenance-status', 'maintenance-evaluate', 'my-vehicle']) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      const alerts = new_alerts > 0 ? `. ${new_alerts} new maintenance alert${new_alerts > 1 ? 's' : ''}.` : '';
      navigate('/driver', { state: { notice: `Reading saved${alerts}` } });
    },
    onError: (e: Error) => setError(e.message),
  });

  if (readings.isPending) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (readings.error) return <RetryAlert message={readings.error.message} onRetry={() => void readings.refetch()} />;

  const latest = readings.data[0]?.reading ?? null;

  const submit = (confirmed: boolean) => {
    if (save.isPending) return;
    setError(null);
    const text = value.replace(/[,\s]/g, '');
    if (!/^\d{1,9}$/.test(text)) {
      setError('Enter the number on the odometer.');
      return;
    }
    const reading = Number(text);
    if (latest != null && reading < latest) {
      setError(`Can't be lower than your last reading (${formatDistance(latest, unit)}).`);
      return;
    }
    if (!confirmed && latest != null && reading - latest > CONFIRM_ABOVE) {
      setConfirmJump(reading - latest);
      return;
    }
    setConfirmJump(null);
    save.mutate(reading);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(false);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5">
        <div>
          <label htmlFor="reading" className="block text-sm font-medium text-stone-700">New reading</label>
          <p className="mt-0.5 text-sm text-stone-500">
            {latest == null ? 'First reading for this vehicle' : `Last reading: ${formatDistance(latest, unit)}`}
          </p>
          <div className="mt-3 flex items-baseline gap-2 rounded-xl border border-stone-200 px-4 py-3 focus-within:border-accent-500 focus-within:ring-4 focus-within:ring-accent-600/10">
            <input
              id="reading"
              value={value}
              onChange={(e) => { setValue(e.target.value); setConfirmJump(null); }}
              inputMode="numeric"
              autoComplete="off"
              placeholder={latest != null ? String(latest) : '0'}
              aria-invalid={!!error}
              aria-describedby={error ? 'reading-error' : undefined}
              className="num w-full min-w-0 bg-transparent text-3xl font-semibold text-ink placeholder:text-stone-300 focus:outline-none"
            />
            <span className="text-base text-stone-500">{unit}</span>
          </div>
          {error && <p id="reading-error" role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
        </div>

        {confirmJump != null ? (
          <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm text-ink">
              That's {formatDistance(confirmJump, unit)} more than last time. Is it correct?
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <Button type="button" variant="secondary" className="min-h-11" onClick={() => setConfirmJump(null)}>Change it</Button>
              <Button type="button" className="min-h-11" loading={save.isPending} onClick={() => submit(true)}>Yes, save</Button>
            </div>
          </div>
        ) : (
          <Button type="submit" loading={save.isPending} className="min-h-12 w-full rounded-xl text-base">Save reading</Button>
        )}
      </form>

      {readings.data.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-ink">Recent readings</h2>
          <ul className="mt-2 divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
            {readings.data.slice(0, 5).map((r) => {
              const at = parseServerTime(r.recorded_at);
              return (
                <li key={r.id} data-testid="reading-item" className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="num font-medium text-ink">{formatDistance(r.reading, unit)}</span>
                  <span className="text-stone-500">
                    {at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

    </div>
  );
}
