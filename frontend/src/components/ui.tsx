import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { statusTone, type Tone } from '../lib/format';

// Small in-house UI kit (Style A). Kept close to shadcn/ui conventions so it can be
// swapped for shadcn later without touching pages.

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-blue-700 text-white hover:bg-blue-800 focus-visible:outline-blue-700',
  secondary: 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 focus-visible:outline-blue-700',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-slate-400',
};

export const buttonClass = (variant: ButtonVariant = 'primary', extra?: string) =>
  cx(
    'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
    buttonStyles[variant],
    extra,
  );

export function Button({
  variant = 'primary',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  return (
    <button className={buttonClass(variant, className)} disabled={disabled || loading} {...props}>
      {loading && <Spinner small />}
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-lg border border-slate-200 bg-white p-4 shadow-sm', className)}>{children}</div>;
}

const inputClass =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ' +
  'placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 ' +
  'aria-[invalid=true]:border-red-500';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cx(inputClass, className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...props },
  ref,
) {
  return <select ref={ref} className={cx(inputClass, className)} {...props} />;
});

// Label + control + error message. The child receives the generated id.
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode;
}) {
  const id = useId();
  const messageId = `${id}-msg`;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': error || hint ? messageId : undefined })}
      {error ? (
        <p id={messageId} className="text-sm text-red-600">{error}</p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

const toneStyles: Record<Tone | 'blue', string> = {
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
  green: 'bg-green-100 text-green-700',
  slate: 'bg-slate-100 text-slate-600',
  blue: 'bg-blue-100 text-blue-700',
};

export function Badge({ tone = 'slate', children }: { tone?: Tone | 'blue'; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', toneStyles[tone])}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{status}</Badge>;
}

const alertStyles = {
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  success: 'border-green-200 bg-green-50 text-green-800',
};

export function Alert({ tone = 'info', children }: { tone?: keyof typeof alertStyles; children: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('rounded-md border px-3 py-2 text-sm', alertStyles[tone])}>
      {children}
    </div>
  );
}

export function Spinner({ small = false }: { small?: boolean }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cx(
        'inline-block animate-spin rounded-full border-blue-200 border-t-blue-700',
        small ? 'h-4 w-4 border-2' : 'h-8 w-8 border-4',
      )}
    />
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2 font-bold text-blue-700', className)}>
      <span aria-hidden className="grid h-7 w-7 place-items-center rounded-md bg-blue-700 text-sm text-white">F</span>
      FleetPMTS
    </span>
  );
}
