import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import * as auth from '../api/auth';
import { setUnauthorizedHandler } from '../api/client';
import type { Session } from '../api/types';

type Status = 'loading' | 'anonymous' | 'authenticated';

interface SessionContextValue {
  status: Status;
  session: Session | null;
  login(email: string, password: string): Promise<Session>;
  signup(input: auth.SignupInput): Promise<Session>;
  logout(): Promise<void>;
  refresh(): Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

// Holds who is logged in (from GET /api/auth/me). The login cookie itself is HttpOnly;
// the browser sends it automatically and JavaScript never sees it.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const signedIn = useCallback((s: Session) => {
    setSession(s);
    setStatus('authenticated');
    return s;
  }, []);

  const signedOut = useCallback(() => {
    setSession(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  const refresh = useCallback(async () => {
    try {
      signedIn(await auth.getMe());
    } catch {
      signedOut();
    }
  }, [signedIn, signedOut]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Session expired or revoked while using the app → back to the login page
  useEffect(() => {
    setUnauthorizedHandler(() => {
      signedOut();
      navigate('/login', { replace: true });
    });
    return () => setUnauthorizedHandler(() => {});
  }, [navigate, signedOut]);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      session,
      login: async (email, password) => signedIn(await auth.login(email, password)),
      signup: async (input) => signedIn(await auth.signup(input)),
      logout: async () => {
        await auth.logout().catch(() => {});
        signedOut();
      },
      refresh,
    }),
    [status, session, signedIn, signedOut, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
