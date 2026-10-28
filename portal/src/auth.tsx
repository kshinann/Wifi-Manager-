import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken, type Role, type Session } from "./api";

interface AuthState {
  session: Session | null;
  loading: boolean;
  signIn: (s: Session) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api<Session>("/api/auth/me")
      .then(setSession)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback((s: Session) => {
    setToken(s.access_token);
    setSession(s);
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setSession(null);
  }, []);

  return <AuthContext.Provider value={{ session, loading, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

const RANK: Record<Role, number> = { viewer: 0, admin: 1, owner: 2 };

export function useCan(minimum: Role): boolean {
  const { session } = useAuth();
  return !!session && RANK[session.user.role] >= RANK[minimum];
}
