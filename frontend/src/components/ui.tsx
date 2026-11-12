import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { statusTone, type Tone } from '../lib/format';

// Small in-house UI kit: minimal style — neutral stone tones, hairline borders,
// black primary actions; color only where it carries meaning (status).

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-accent-600 text-white hover:bg-accent-700 active:bg-accent-800',
  secondary: 'border border-stone-200 bg-white text-ink hover:border-stone-300 hover:bg-stone-50',
  ghost: 'text-stone-600 hover:bg-stone-100 hover:text-ink',
};

export const buttonClass = (variant: ButtonVariant = 'primary', extra?: string) =>
  cx(
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600',
    'disabled:cursor-not-allowed disabled:opacity-50',
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
      {loading && <Spinner small inverted={variant === 'primary'} />}
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-xl border border-stone-200 bg-white p-5', className)}>{children}</div>;
}

const inputClass =
  'block w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-ink ' +
  'placeholder:text-stone-400 transition-colors focus:border-accent-500 focus:outline-none focus:ring-4 focus:ring-accent-600/10 ' +
  'aria-[invalid=true]:border-red-400 aria-[invalid=true]:focus:ring-red-500/10';

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
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-stone-700">
        {label}
      </label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': error || hint ? messageId : undefined })}
      {error ? (
        <p id={messageId} className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-stone-500">{hint}</p>
      ) : null}
    </div>
  );
}

const toneStyles: Record<Tone | 'blue', string> = {
  red: 'bg-red-50 text-red-700',
  amber: 'bg-amber-50 text-amber-700',
  green: 'bg-green-50 text-green-700',
  slate: 'bg-stone-100 text-stone-500',
  blue: 'bg-stone-100 text-stone-700',
};

export function Badge({ tone = 'slate', children }: { tone?: Tone | 'blue'; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium', toneStyles[tone])}>
      {children}
    </span>
  );
}

const dotStyles: Record<Tone, string> = {
  red: 'bg-red-600',
  amber: 'bg-amber-500',
  green: 'bg-green-600',
  slate: 'bg-stone-400',
};

export function StatusDot({ tone }: { tone: Tone }) {
  return <span aria-hidden className={cx('inline-block h-1.5 w-1.5 shrink-0 rounded-full', dotStyles[tone])} />;
}

// "● Overdue" — a colored dot plus the word
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-stone-700">
      <StatusDot tone={statusTone(status)} />
      {status}
    </span>
  );
}

const alertStyles = {
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-stone-200 bg-stone-50 text-stone-600',
  success: 'border-green-200 bg-green-50 text-green-800',
};

export function Alert({ tone = 'info', children }: { tone?: keyof typeof alertStyles; children: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('rounded-lg border px-3 py-2 text-sm', alertStyles[tone])}>
      {children}
    </div>
  );
}

// Error message with a Retry button (server unreachable, 5xx, failed section)
export function RetryAlert({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      <span>{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
      >
        Retry
      </button>
    </div>
  );
}

export function Spinner({ small = false, inverted = false }: { small?: boolean; inverted?: boolean }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cx(
        'inline-block animate-spin rounded-full border-2',
        inverted ? 'border-white/30 border-t-white' : 'border-accent-100 border-t-accent-600',
        small ? 'h-4 w-4' : 'h-6 w-6',
      )}
    />
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2 font-display text-[15px] font-semibold tracking-tight text-ink', className)}>
      <span aria-hidden className="h-2 w-2 rounded-full bg-accent-600" />
      FleetPMTS
    </span>
  );
}

// Uppercase section label, e.g. sidebar groups
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('text-[11px] font-medium uppercase tracking-wider text-stone-400', className)}>{children}</p>;
}
