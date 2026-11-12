import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { can, Permissions } from '../auth/guards';
import { useSession } from '../auth/SessionProvider';
import { Alert, cx, Eyebrow, Logo } from '../components/ui';

type NavItem = { label: string; to?: string; permission?: string };
type NavGroup = { title?: string; items: NavItem[] };

// Items without `to` are coming in Milestone C
const NAV: NavGroup[] = [
  { items: [{ label: 'Dashboard', to: '/admin' }] },
  { title: 'Fleet', items: [{ label: 'Vehicles' }, { label: 'Drivers' }, { label: 'Maintenance' }, { label: 'Trips' }] },
  { title: 'Money', items: [{ label: 'Expenses' }, { label: 'Reports' }] },
  {
    title: 'Organization',
    items: [
      { label: 'Admins', permission: Permissions.AdminsManage },
      { label: 'Settings', permission: Permissions.OrgManage },
    ],
  },
];

const itemClass = 'flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm';

export function AdminLayout({ children }: { children: ReactNode }) {
  const { session, logout } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const groups = NAV
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.permission || can(session, i.permission)) }))
    .filter((g) => g.items.length > 0);

  const onLogout = async () => {
    setLogoutError(null);
    try {
      await logout();
      navigate('/', { replace: true });
    } catch (e) {
      setLogoutError(e instanceof Error ? e.message : "Couldn't log out.");
    }
  };

  const name = session?.user.full_name ?? '';
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

  const sidebar = (
    <nav aria-label="Main" className="flex h-full flex-col">
      <div className="px-5 pb-4 pt-5">
        <Logo />
        <p className="mt-1 truncate pl-4 text-xs text-stone-500" title={session?.organization.name}>
          {session?.organization.name}
        </p>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {groups.map((group, gi) => (
          <div key={group.title ?? gi}>
            {group.title && <Eyebrow className="mb-1 px-2.5">{group.title}</Eyebrow>}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.label}>
                  {item.to ? (
                    <NavLink
                      to={item.to}
                      end
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        cx(itemClass, isActive ? 'bg-accent-50 font-medium text-accent-700' : 'text-stone-600 hover:bg-stone-100 hover:text-ink')
                      }
                    >
                      {item.label}
                    </NavLink>
                  ) : (
                    <span className={cx(itemClass, 'cursor-default text-stone-400')} aria-disabled="true">
                      {item.label} <span className="text-[10px] uppercase tracking-wider text-stone-300">Soon</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 border-t border-stone-200 px-4 py-4">
        <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-50 text-xs font-medium text-accent-700">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{name}</p>
          <p className="truncate text-xs text-stone-500">{session?.user.role}</p>
        </div>
        <button type="button" onClick={onLogout} className="text-xs font-medium text-stone-500 hover:text-ink">
          Log out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-stone-50 md:flex">
      {/* Phone: top bar with menu button */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Menu"
          className="rounded-md p-2 text-stone-600 hover:bg-stone-100"
        >
          <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </header>
      {open && <div className="border-b border-stone-200 bg-white md:hidden">{sidebar}</div>}

      {/* Desktop: fixed sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-stone-200 bg-white md:block">{sidebar}</aside>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
        {logoutError && <div className="mx-auto mb-4 max-w-6xl"><Alert tone="error">{logoutError}</Alert></div>}
        {children}
      </main>
    </div>
  );
}
