import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { changePassword, getMe } from '../../api/auth';
import { homePathFor } from '../../auth/guards';
import { useSession } from '../../auth/SessionProvider';
import { Alert, Button, Field, Input } from '../../components/ui';
import { AuthCard, PublicLayout } from '../../layouts/PublicLayout';

const schema = z
  .object({
    current_password: z.string().min(1, 'Enter your current password'),
    new_password: z.string().min(8, 'Use at least 8 characters'),
    confirm: z.string(),
  })
  .refine((v) => v.new_password === v.confirm, { path: ['confirm'], message: "Passwords don't match" });
type Values = z.infer<typeof schema>;

export function ChangePassword() {
  const { session, refresh, logout } = useSession();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });
  const forced = !!session?.user.must_change_password;

  const onSubmit = handleSubmit(async ({ current_password, new_password }) => {
    setServerError(null);
    try {
      await changePassword(current_password, new_password);
      await refresh();
      navigate(homePathFor(await getMe()), { replace: true });
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Could not change the password.');
    }
  });

  return (
    <PublicLayout testId="page-change-password">
      <AuthCard
        title="Change password"
        subtitle={forced ? 'Your account uses a temporary password. Choose a new one to continue.' : undefined}
      >
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {serverError && <Alert tone="error">{serverError}</Alert>}
          <Field label="Current password" error={formState.errors.current_password?.message}>
            {(p) => <Input {...p} type="password" autoComplete="current-password" {...register('current_password')} />}
          </Field>
          <Field label="New password" error={formState.errors.new_password?.message} hint="At least 8 characters">
            {(p) => <Input {...p} type="password" autoComplete="new-password" {...register('new_password')} />}
          </Field>
          <Field label="Confirm new password" error={formState.errors.confirm?.message}>
            {(p) => <Input {...p} type="password" autoComplete="new-password" {...register('confirm')} />}
          </Field>
          <Button type="submit" className="w-full" loading={formState.isSubmitting}>Change password</Button>
        </form>
        <button
          type="button"
          onClick={() => logout().then(() => navigate('/login', { replace: true }))}
          className="mt-4 w-full text-center text-sm text-slate-500 hover:text-slate-700"
        >
          Log out
        </button>
      </AuthCard>
    </PublicLayout>
  );
}
