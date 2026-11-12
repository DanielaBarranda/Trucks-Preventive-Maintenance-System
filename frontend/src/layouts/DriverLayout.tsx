import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { Alert, cx, Logo } from '../components/ui';

// Simple line icons (24×24, stroke = currentColor)
const ICONS: Record<string, ReactNode> = {
  Home: <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />,
  Trips: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" /></>,
  Expenses: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18M7 15h3" /></>,
  Status: <><path d="M12 3l8 4v5c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V7z" /><path d="M9 12l2 2 4-4" /></>,
};

const TABS = [
  { label: 'Home', active: true },
  { label: 'Trips' },
  { label: 'Expenses' },
  { label: 'Status' },
];

// Phone-first: a single column with a bottom tab bar (centered on desktop)
export function DriverLayout({ children }: { children: ReactNode }) {
  const { logout } = useSession();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const onLogout = () => {
    setLogoutError(null);
    logout().then(
      () => navigate('/', { replace: true }),
      (e: Error) => setLogoutError(e.message),
    );
  };

  return (
    <div className="flex min-h-screen justify-center bg-stone-100">
      <div className="flex min-h-screen w-full max-w-md flex-col bg-stone-50 sm:border-x sm:border-stone-200">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200/70 bg-stone-50/90 px-5 py-3.5 backdrop-blur">
          <Logo />
          <button type="button" onClick={onLogout} className="text-sm font-medium text-stone-500 hover:text-ink">
            Log out
          </button>
        </header>

        <main className="flex-1 px-5 py-6">
          {logoutError && <div className="mb-4"><Alert tone="error">{logoutError}</Alert></div>}
          {children}
        </main>

        <nav aria-label="Driver" className="sticky bottom-0 grid grid-cols-4 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          {TABS.map((t) => (
            <span
              key={t.label}
              aria-current={t.active ? 'page' : undefined}
              aria-disabled={t.active ? undefined : true}
              title={t.active ? undefined : 'Coming soon'}
              className={cx('flex flex-col items-center gap-1 py-2.5 text-[11px]', t.active ? 'font-medium text-ink' : 'text-stone-400')}
            >
              <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                {ICONS[t.label]}
              </svg>
              {t.label}
            </span>
          ))}
        </nav>
      </div>
    </div>
  );
}
