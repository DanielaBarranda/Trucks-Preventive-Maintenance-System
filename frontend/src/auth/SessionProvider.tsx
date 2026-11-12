import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import * as auth from '../api/auth';
import { ApiError, setUnauthorizedHandler } from '../api/client';
import type { Session } from '../api/types';

// 'error' = the session couldn't be checked (server unreachable / 5xx); the cookie may still be valid
type Status = 'loading' | 'anonymous' | 'authenticated' | 'error';

interface SessionContextValue {
  status: Status;
  session: Session | null;
  error: string | null;
  login(email: string, password: string): Promise<Session>;
  signup(input: auth.SignupInput): Promise<Session>;
  logout(): Promise<void>;
  refresh(): Promise<Session | null>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

// Holds who is logged in (from GET /api/auth/me). The login cookie itself is HttpOnly;
// the browser sends it automatically and JavaScript never sees it.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const signedIn = useCallback((s: Session) => {
    setSession(s);
    setError(null);
    setStatus('authenticated');
    return s;
  }, []);

  const signedOut = useCallback(() => {
    setSession(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  // Only a 401 means "not logged in". Anything else (no connection, server error) keeps
  // the user where they are and offers a retry instead of dropping them to the login page.
  // Returns the fresh session, or null when not logged in / not reachable.
  const refresh = useCallback(async (): Promise<Session | null> => {
    setStatus((current) => (current === 'authenticated' ? current : 'loading'));
    try {
      return signedIn(await auth.getMe());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        signedOut();
      } else {
        setError(e instanceof ApiError && e.status !== 0 ? `${e.message} (server error)` : "Can't reach the server.");
        setStatus('error');
      }
      return null;
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
      error,
      login: async (email, password) => signedIn(await auth.login(email, password)),
      signup: async (input) => signedIn(await auth.signup(input)),
      // If the server can't be reached the login cookie stays valid, so say so instead of
      // pretending to be logged out (matters on shared devices)
      logout: async () => {
        try {
          await auth.logout();
        } catch (e) {
          if (!(e instanceof ApiError && e.status === 401))
            throw new Error("Couldn't log out. Check your connection and try again.");
        }
        signedOut();
      },
      refresh,
    }),
    [status, session, error, signedIn, signedOut, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
