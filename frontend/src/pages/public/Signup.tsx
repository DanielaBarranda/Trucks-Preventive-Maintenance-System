import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { homePathFor } from '../../auth/guards';
import { useSession } from '../../auth/SessionProvider';
import { Alert, Button, Field, Input, Select } from '../../components/ui';
import { AuthCard, PublicLayout } from '../../layouts/PublicLayout';

const CATEGORIES = ['Truck', 'Van & Car', 'Motorcycle'] as const;

const schema = z.object({
  organization_name: z.string().trim().min(1, 'Enter your organization name').max(100),
  owner_name: z.string().trim().min(1, 'Enter your name').max(100),
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters'),
  currency_code: z.enum(['PHP', 'USD', 'EUR']),
  distance_unit: z.enum(['km', 'mi']),
  template_categories: z.array(z.enum(CATEGORIES)),
});
type Values = z.infer<typeof schema>;

export function Signup() {
  const { signup } = useSession();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currency_code: 'PHP', distance_unit: 'km', template_categories: ['Truck'] },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const session = await signup(values);
      navigate(homePathFor(session), { replace: true });
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Sign-up failed.');
    }
  });

  const errors = formState.errors;

  return (
    <PublicLayout testId="page-signup">
      <AuthCard title="Create your organization" subtitle="You'll be the Owner. Add admins and drivers after signing up.">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {serverError && <Alert tone="error">{serverError}</Alert>}
          <Field label="Organization name" error={errors.organization_name?.message}>
            {(p) => <Input {...p} autoComplete="organization" {...register('organization_name')} />}
          </Field>
          <Field label="Your name" error={errors.owner_name?.message}>
            {(p) => <Input {...p} autoComplete="name" {...register('owner_name')} />}
          </Field>
          <Field label="Email" error={errors.email?.message}>
            {(p) => <Input {...p} type="email" autoComplete="email" {...register('email')} />}
          </Field>
          <Field label="Password" error={errors.password?.message} hint="At least 8 characters">
            {(p) => <Input {...p} type="password" autoComplete="new-password" {...register('password')} />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Currency">
              {(p) => (
                <Select {...p} {...register('currency_code')}>
                  <option value="PHP">PHP (₱)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </Select>
              )}
            </Field>
            <Field label="Distance unit">
              {(p) => (
                <Select {...p} {...register('distance_unit')}>
                  <option value="km">Kilometers</option>
                  <option value="mi">Miles</option>
                </Select>
              )}
            </Field>
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-stone-700">Vehicle types (starter maintenance schedules)</legend>
            <div className="mt-2 flex flex-wrap gap-4">
              {CATEGORIES.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" value={c} className="h-4 w-4 rounded border-stone-300 accent-stone-900" {...register('template_categories')} />
                  {c}
                </label>
              ))}
            </div>
          </fieldset>
          <Button type="submit" className="w-full" loading={formState.isSubmitting}>Create account</Button>
        </form>
        <p className="mt-6 text-center text-sm text-stone-500">
          Already have an account? <Link to="/login" className="font-medium text-ink underline decoration-stone-300 underline-offset-4 hover:decoration-ink">Log in</Link>
        </p>
      </AuthCard>
    </PublicLayout>
  );
}
