import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { buttonClass, Logo } from '../components/ui';

export function PublicLayout({ children, testId }: { children: ReactNode; testId: string }) {
  return (
    <div className="min-h-screen bg-stone-50" data-testid={testId}>
      <header className="border-b border-stone-200/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" aria-label="FleetPMTS home"><Logo /></Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link to="/login" className={buttonClass('ghost', 'px-3 py-1.5')}>Log in</Link>
            <Link to="/signup" className={buttonClass('primary', 'hidden px-3 py-1.5 sm:inline-flex')}>Sign up</Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}

// Centered card used by the login, sign-up and change-password pages
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="flex justify-center px-4 py-12 sm:py-20">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-stone-500">{subtitle}</p>}
        <div className="mt-8 rounded-xl border border-stone-200 bg-white p-6">{children}</div>
      </div>
    </main>
  );
}
