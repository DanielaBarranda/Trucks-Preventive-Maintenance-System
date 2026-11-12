import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { createTrip } from '../../api/driver';
import { DriverPage, useMyVehicleGate } from '../../components/DriverPage';
import { Alert, Button, Field, Input } from '../../components/ui';
import { todayLocal } from '../../lib/dates';

const schema = z.object({
  trip_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
  pickup_location: z.string().trim().min(1, 'Enter the pickup place').max(100, 'Keep it under 100 characters'),
  pickup_address: z.string().trim().min(1, 'Enter the pickup address').max(255, 'Keep it under 255 characters'),
  destination: z.string().trim().min(1, 'Enter the destination').max(100, 'Keep it under 100 characters'),
  scheduled_time: z.string(),
});
type Values = z.infer<typeof schema>;

export function NewTrip() {
  const { gate } = useMyVehicleGate();
  return <DriverPage title="New trip" back="/driver/trips" narrow>{gate ?? <TripForm />}</DriverPage>;
}

function TripForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { trip_date: todayLocal(), pickup_location: '', pickup_address: '', destination: '', scheduled_time: '' },
  });

  const save = useMutation({
    mutationFn: createTrip,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
      navigate('/driver/trips', { state: { notice: 'Trip added' } });
    },
  });

  const onSubmit = handleSubmit(({ scheduled_time, ...rest }) => {
    if (save.isPending) return;
    save.mutate(scheduled_time ? { ...rest, scheduled_time } : rest);
  });

  const e = formState.errors;
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5">
      {save.isError && <Alert tone="error">{save.error.message}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" error={e.trip_date?.message}>
          {(p) => <Input {...p} type="date" className="min-h-11" {...register('trip_date')} />}
        </Field>
        <Field label="Time (optional)">
          {(p) => <Input {...p} type="time" className="min-h-11" {...register('scheduled_time')} />}
        </Field>
      </div>
      <Field label="Pickup place" error={e.pickup_location?.message}>
        {(p) => <Input {...p} className="min-h-11" placeholder="e.g. Main depot" {...register('pickup_location')} />}
      </Field>
      <Field label="Pickup address" error={e.pickup_address?.message}>
        {(p) => <Input {...p} className="min-h-11" autoComplete="street-address" {...register('pickup_address')} />}
      </Field>
      <Field label="Destination" error={e.destination?.message}>
        {(p) => <Input {...p} className="min-h-11" {...register('destination')} />}
      </Field>
      <Button type="submit" loading={save.isPending} className="min-h-12 w-full rounded-xl text-base">Add trip</Button>
    </form>
  );
}
