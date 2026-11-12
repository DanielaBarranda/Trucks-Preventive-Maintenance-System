import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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
  { label: 'Home', to: '/driver', end: true },
  { label: 'Trips', to: '/driver/trips', end: false },
  { label: 'Expenses', to: '/driver/expenses', end: false },
  { label: 'Status', to: '/driver/status', end: false },
];

const Icon = ({ name, size = 20 }: { name: string; size?: number }) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {ICONS[name]}
  </svg>
);

// Phone: one column with a bottom tab bar. Desktop (lg and up): a side menu, and the
// page uses the width (pages decide how wide their content gets).
export function DriverLayout({ children }: { children: ReactNode }) {
  const { session, logout } = useSession();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const onLogout = () => {
    setLogoutError(null);
    logout().then(
      () => navigate('/', { replace: true }),
      (e: Error) => setLogoutError(e.message),
    );
  };

  const name = session?.user.full_name ?? '';
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

  return (
    <div className="min-h-screen bg-stone-100 lg:flex lg:bg-stone-50">
      {/* Desktop: side menu */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-stone-200 bg-white lg:block">
        <nav aria-label="Driver menu" className="flex h-full flex-col">
          <div className="px-5 pb-4 pt-5">
            <Logo />
            <p className="mt-1 truncate pl-4 text-xs text-stone-500" title={session?.organization.name}>{session?.organization.name}</p>
          </div>
          <ul className="flex-1 space-y-0.5 px-3 py-2">
            {TABS.map((t) => (
              <li key={t.label}>
                <NavLink
                  to={t.to}
                  end={t.end}
                  className={({ isActive }) =>
                    cx('flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm',
                      isActive ? 'bg-accent-50 font-medium text-accent-700' : 'text-stone-600 hover:bg-stone-100 hover:text-ink')}
                >
                  <Icon name={t.label} size={18} />
                  {t.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3 border-t border-stone-200 px-4 py-4">
            <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-50 text-xs font-medium text-accent-700">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{name}</p>
              <p className="truncate text-xs text-stone-500">{session?.user.role}</p>
            </div>
            <button type="button" onClick={onLogout} className="text-xs font-medium text-stone-500 hover:text-ink">Log out</button>
          </div>
        </nav>
      </aside>

      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-stone-50 sm:border-x sm:border-stone-200 lg:mx-0 lg:max-w-none lg:flex-1 lg:border-x-0">
        {/* Phone: top bar */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200/70 bg-stone-50/90 px-5 py-3.5 backdrop-blur lg:hidden">
          <Logo />
          <button type="button" onClick={onLogout} className="text-sm font-medium text-stone-500 hover:text-ink">Log out</button>
        </header>

        <main className="flex-1 px-5 py-6 lg:px-10 lg:py-10">
          <div className="lg:mx-auto lg:max-w-5xl">
            {logoutError && <div className="mb-4"><Alert tone="error">{logoutError}</Alert></div>}
            {children}
          </div>
        </main>

        {/* Phone: bottom tabs */}
        <nav aria-label="Driver" className="sticky bottom-0 grid grid-cols-4 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          {TABS.map((t) => (
            <NavLink
              key={t.label}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cx('flex min-h-[52px] flex-col items-center justify-center gap-1 py-2 text-[11px] transition-colors',
                  isActive ? 'font-medium text-accent-600' : 'text-stone-500 hover:text-ink')}
            >
              <Icon name={t.label} />
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
