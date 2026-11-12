import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getMyVehicle } from '../api/fleet';
import type { Vehicle } from '../api/types';
import { DriverLayout } from '../layouts/DriverLayout';
import { cx, RetryAlert, Spinner } from './ui';

// One driver screen: a title (with an optional back link) inside the driver layout.
// narrow: forms keep a comfortable width on desktop instead of stretching.
export function DriverPage({ title, back, action, narrow, children }: {
  title: string; back?: string; action?: ReactNode; narrow?: boolean; children: ReactNode;
}) {
  return (
    <DriverLayout>
      <div className={cx('space-y-5', narrow && 'lg:mx-auto lg:max-w-xl')}>
        <div>
          {back && (
            <Link to={back} className="-ml-1 mb-2 inline-flex items-center gap-1 rounded-md py-1 pr-2 text-sm text-stone-500 hover:text-ink">
              <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Back
            </Link>
          )}
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{title}</h1>
            {action}
          </div>
        </div>
        {children}
      </div>
    </DriverLayout>
  );
}

export function NoVehicleCard() {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 px-6 py-10 text-center">
      <p className="font-medium text-ink">No vehicle assigned yet.</p>
      <p className="mt-1 text-sm text-stone-500">Ask your admin to assign one to you.</p>
    </div>
  );
}

// The driver's vehicle, plus what to show instead of the page while it loads,
// when it fails, or when no vehicle is assigned (gate is null when the page can render)
export function useMyVehicleGate(): { vehicle: Vehicle | null; gate: ReactNode | null } {
  const query = useQuery({ queryKey: ['my-vehicle'], queryFn: getMyVehicle });
  if (query.isPending) return { vehicle: null, gate: <div className="flex justify-center py-12"><Spinner /></div> };
  if (query.error) return { vehicle: null, gate: <RetryAlert message={query.error.message} onRetry={() => void query.refetch()} /> };
  if (!query.data) return { vehicle: null, gate: <NoVehicleCard /> };
  return { vehicle: query.data, gate: null };
}

// A one-time success message passed by the page that just saved something
// (navigate('/driver', { state: { notice } })). Cleared from history so a refresh doesn't repeat it.
export function useNotice(): string | null {
  const location = useLocation();
  const navigate = useNavigate();
  const [notice] = useState<string | null>(() => (location.state as { notice?: string } | null)?.notice ?? null);
  useEffect(() => {
    if ((location.state as { notice?: string } | null)?.notice) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);
  return notice;
}
