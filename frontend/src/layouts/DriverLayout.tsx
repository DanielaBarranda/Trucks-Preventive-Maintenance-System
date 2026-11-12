import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { Logo } from '../components/ui';

const TABS = [
  { label: 'Home', icon: '⌂', active: true },
  { label: 'Trips', icon: '⇄' },
  { label: 'Expenses', icon: '₱' },
  { label: 'Status', icon: '🔧' },
];

// Phone-first: a single column with a bottom tab bar (centered on desktop)
export function DriverLayout({ children }: { children: ReactNode }) {
  const { session, logout } = useSession();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen justify-center bg-slate-100">
      <div className="flex min-h-screen w-full max-w-md flex-col bg-slate-50 sm:border-x sm:border-slate-200">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div className="min-w-0">
            <Logo className="text-sm" />
            <p className="truncate text-xs text-slate-500">{session?.organization.name}</p>
          </div>
          <button
            type="button"
            onClick={() => logout().then(() => navigate('/', { replace: true }))}
            className="text-sm font-semibold text-blue-700 hover:text-blue-800"
          >
            Log out
          </button>
        </header>

        <main className="flex-1 px-4 py-5">{children}</main>

        <nav aria-label="Driver" className="sticky bottom-0 grid grid-cols-4 border-t border-slate-200 bg-white">
          {TABS.map((t) => (
            <span
              key={t.label}
              aria-current={t.active ? 'page' : undefined}
              aria-disabled={t.active ? undefined : true}
              title={t.active ? undefined : 'Coming soon'}
              className={`flex flex-col items-center py-2 text-xs ${t.active ? 'font-semibold text-blue-700' : 'text-slate-400'}`}
            >
              <span aria-hidden className="text-base">{t.icon}</span>
              {t.label}
            </span>
          ))}
        </nav>
      </div>
    </div>
  );
}
