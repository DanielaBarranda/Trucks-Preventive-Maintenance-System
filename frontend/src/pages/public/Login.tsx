import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { homePathFor } from '../../auth/guards';
import { useSession } from '../../auth/SessionProvider';
import { Alert, Button, Field, Input } from '../../components/ui';
import { AuthCard, PublicLayout } from '../../layouts/PublicLayout';

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});
type Values = z.infer<typeof schema>;

export function Login() {
  const { login } = useSession();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError(null);
    try {
      const session = await login(email, password);
      navigate(homePathFor(session), { replace: true });
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Login failed.');
    }
  });

  return (
    <PublicLayout testId="page-login">
      <AuthCard title="Welcome back" subtitle="Log in to your organization">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {serverError && <Alert tone="error">{serverError}</Alert>}
          <Field label="Email" error={formState.errors.email?.message}>
            {(p) => <Input {...p} type="email" autoComplete="email" placeholder="you@company.com" {...register('email')} />}
          </Field>
          <Field label="Password" error={formState.errors.password?.message}>
            {(p) => <Input {...p} type="password" autoComplete="current-password" {...register('password')} />}
          </Field>
          <Button type="submit" className="w-full" loading={formState.isSubmitting}>Log in</Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          New company? <Link to="/signup" className="font-semibold text-blue-700 hover:text-blue-800">Create an account</Link>
        </p>
        <div className="mt-4">
          <Alert tone="info">Demo: owner@northwind.demo / Demo1234!</Alert>
        </div>
      </AuthCard>
    </PublicLayout>
  );
}
