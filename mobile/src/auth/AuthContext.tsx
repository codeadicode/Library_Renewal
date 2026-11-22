import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

import { mockApi, PublicStudent } from '../api/mockStore';
import { RegisterInput } from '../domain/types';

interface AuthContextValue {
  user: PublicStudent | null;
  login: (identifier: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicStudent | null>(null);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      async login(identifier, password) {
        const next = await mockApi.login(identifier, password);
        setUser(next);
      },
      async register(input) {
        const next = await mockApi.register(input);
        setUser(next);
      },
      logout() {
        setUser(null);
      },
      async refresh() {
        if (!user) return;
        const next = await mockApi.me(user.id);
        setUser(next);
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
