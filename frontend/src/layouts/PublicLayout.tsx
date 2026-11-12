import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/ui';

export function PublicLayout({ children, testId }: { children: ReactNode; testId: string }) {
  return (
    <div className="min-h-screen bg-slate-100" data-testid={testId}>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" aria-label="FleetPMTS home"><Logo /></Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/login" className="font-semibold text-blue-700 hover:text-blue-800">Log in</Link>
            <Link to="/signup" className="hidden rounded-md bg-blue-700 px-3 py-1.5 font-semibold text-white hover:bg-blue-800 sm:inline-block">
              Sign up
            </Link>
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
    <main className="flex justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
