import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { arriveTrip, departTrip, getTrips } from '../../api/driver';
import type { Trip } from '../../api/types';
import { DriverPage, useMyVehicleGate, useNotice } from '../../components/DriverPage';
import { Alert, Button, buttonClass, RetryAlert, Spinner } from '../../components/ui';
import { formatDateOnly, formatTime } from '../../lib/dates';

export function Trips() {
  const { gate } = useMyVehicleGate();
  const notice = useNotice();
  const newTrip = <Link to="/driver/trips/new" className={buttonClass('secondary', 'min-h-11 rounded-xl')}>+ New trip</Link>;
  return (
    <DriverPage title="Trips" action={gate ? undefined : newTrip}>
      {notice && <Alert tone="success">{notice}</Alert>}
      {gate ?? <TripList />}
    </DriverPage>
  );
}

function TripList() {
  const trips = useQuery({ queryKey: ['trips'], queryFn: getTrips });

  if (trips.isPending) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (trips.error) return <RetryAlert message={trips.error.message} onRetry={() => void trips.refetch()} />;

  if (trips.data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 px-6 py-10 text-center">
        <p className="font-medium text-ink">No trips yet</p>
        <p className="mt-1 text-sm text-stone-500">Add a trip before you leave.</p>
        <Link to="/driver/trips/new" className={buttonClass('primary', 'mt-5 min-h-11 rounded-xl')}>+ New trip</Link>
      </div>
    );
  }

  const onRoad = trips.data.filter((t) => t.departed_at && !t.arrived_at);
  const planned = trips.data.filter((t) => !t.departed_at);
  const done = trips.data.filter((t) => t.arrived_at);

  return (
    <div className="space-y-6">
      <Group title="On the road" trips={onRoad} />
      <Group title="Planned" trips={planned} />
      <Group title="Done" trips={done} />
    </div>
  );
}

function Group({ title, trips }: { title: string; trips: Trip[] }) {
  if (trips.length === 0) return null;
  return (
    <section>
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <ul className="mt-2 space-y-2.5">
        {trips.map((t) => <TripCard key={t.id} trip={t} />)}
      </ul>
    </section>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  const queryClient = useQueryClient();
  const state = trip.arrived_at ? 'Done' : trip.departed_at ? 'On the road' : 'Planned';

  const action = useMutation({
    mutationFn: () => (trip.departed_at ? arriveTrip(trip.id) : departTrip(trip.id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trips'] }),
  });

  return (
    <li data-testid={`trip-${trip.id}`} className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{trip.destination}</p>
          <p className="truncate text-sm text-stone-500">From {trip.pickup_location} · {trip.pickup_address}</p>
        </div>
        <span className="shrink-0 text-xs font-medium text-stone-500">{state}</span>
      </div>
      <p className="mt-2 text-sm text-stone-600">
        {formatDateOnly(trip.trip_date)}
        {trip.scheduled_time && ` · ${formatClock(trip.scheduled_time)}`}
      </p>
      {(trip.departed_at || trip.arrived_at) && (
        <p className="mt-1 text-sm text-stone-600">
          {trip.departed_at && `Departed ${formatTime(trip.departed_at)}`}
          {trip.arrived_at && ` · Arrived ${formatTime(trip.arrived_at)}`}
        </p>
      )}
      {action.isError && <p role="alert" className="mt-2 text-sm text-red-600">{action.error.message}</p>}
      {!trip.arrived_at && (
        <Button
          variant={trip.departed_at ? 'primary' : 'secondary'}
          loading={action.isPending}
          onClick={() => { if (!action.isPending) action.mutate(); }}
          className="mt-3 min-h-11 w-full rounded-xl"
        >
          {trip.departed_at ? 'Mark arrived' : 'Mark departed'}
        </Button>
      )}
    </li>
  );
}

// "08:30:00" → "8:30 AM" (a wall-clock time, no time zone)
function formatClock(hms: string): string {
  const [h, m] = hms.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
