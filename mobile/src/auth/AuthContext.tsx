import { useQueryClient } from '@tanstack/react-query';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, ApiError, PublicStudent, session } from '../api';
import { ProfilePatch, RegisterInput } from '../domain/types';
import { secureStorage, STORAGE_KEYS } from '../storage/secureStorage';

interface StoredSession {
  mode: 'api' | 'mock';
  token?: string;
  userId: string;
}

interface AuthContextValue {
  user: PublicStudent | null;
  /** False until a stored session has been restored (or found absent). */
  ready: boolean;
  /** Set when the server ended the session (e.g. expired token). */
  sessionMessage: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function persist(user: PublicStudent, token?: string) {
  const value: StoredSession = { mode: api.mode, token, userId: user.id };
  await secureStorage.set(STORAGE_KEYS.session, JSON.stringify(value));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<PublicStudent | null>(null);
  const [ready, setReady] = useState(false);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  const clearSession = useCallback(async () => {
    session.setToken(null);
    setUser(null);
    queryClient.clear();
    await secureStorage.remove(STORAGE_KEYS.session);
  }, [queryClient]);

  // Restore the stored session on launch. The token is validated with /auth/me;
  // an expired or rejected token signs the user out instead of leaving a half-session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await secureStorage.get(STORAGE_KEYS.session);
        if (!raw) return;
        const stored = JSON.parse(raw) as StoredSession;
        if (stored.mode !== api.mode) {
          await secureStorage.remove(STORAGE_KEYS.session);
          return;
        }
        if (stored.token) session.setToken(stored.token);
        const me = await api.me(stored.userId);
        if (!cancelled) setUser(me);
      } catch (err) {
        if (err instanceof ApiError && err.status === 0) {
          // Server unreachable: keep the stored session so the user is not logged out by a network blip.
          if (!cancelled) setSessionMessage(err.message);
        } else {
          session.setToken(null);
          await secureStorage.remove(STORAGE_KEYS.session);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // A 401 on any authenticated call ends the session.
  useEffect(() => {
    session.onUnauthorized(() => {
      setSessionMessage('Your session has expired. Please sign in again.');
      void clearSession();
    });
    return () => session.onUnauthorized(null);
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      sessionMessage,
      async login(identifier, password) {
        const res = await api.login(identifier, password);
        await persist(res.user, res.token);
        setSessionMessage(null);
        setUser(res.user);
      },
      async register(input) {
        const res = await api.register(input);
        await persist(res.user, res.token);
        setSessionMessage(null);
        setUser(res.user);
      },
      async logout() {
        setSessionMessage(null);
        await clearSession();
      },
      async refresh() {
        if (!user) return;
        setUser(await api.me(user.id));
      },
      async updateProfile(patch) {
        if (!user) return;
        setUser(await api.updateProfile(user.id, patch));
      },
    }),
    [user, ready, sessionMessage, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
