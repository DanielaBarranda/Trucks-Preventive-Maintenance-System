import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { can, Permissions } from '../auth/guards';
import { useSession } from '../auth/SessionProvider';
import { Badge, Logo } from '../components/ui';

type NavItem = { label: string; to?: string; permission?: string };

// Items without `to` are coming in Milestone C
const NAV: NavItem[] = [
  { label: 'Dashboard', to: '/admin' },
  { label: 'Vehicles' },
  { label: 'Drivers' },
  { label: 'Maintenance' },
  { label: 'Trips' },
  { label: 'Expenses' },
  { label: 'Reports' },
  { label: 'Admins', permission: Permissions.AdminsManage },
  { label: 'Settings', permission: Permissions.OrgManage },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const { session, logout } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((i) => !i.permission || can(session, i.permission));

  const onLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const sidebar = (
    <nav aria-label="Main" className="flex h-full flex-col">
      <div className="px-4 py-4">
        <Logo />
        <p className="mt-2 truncate text-sm font-medium text-slate-700" title={session?.organization.name}>
          {session?.organization.name}
        </p>
      </div>
      <ul className="flex-1 space-y-1 px-2">
        {items.map((item) => (
          <li key={item.label}>
            {item.to ? (
              <NavLink
                to={item.to}
                end
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm font-medium ${
                    isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ) : (
              <span className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-slate-400" aria-disabled="true">
                {item.label} <Badge>Soon</Badge>
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="border-t border-slate-200 px-4 py-3">
        <p className="truncate text-sm font-medium text-slate-800">{session?.user.full_name}</p>
        <p className="truncate text-xs text-slate-500">{session?.user.role}</p>
        <button type="button" onClick={onLogout} className="mt-2 text-sm font-semibold text-blue-700 hover:text-blue-800">
          Log out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-100 md:flex">
      {/* Phone: top bar with menu button */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Menu"
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
        >
          ☰
        </button>
      </header>
      {open && <div className="border-b border-slate-200 bg-white md:hidden">{sidebar}</div>}

      {/* Desktop: fixed sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:block">{sidebar}</aside>

      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
