import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "./api";
import { Role } from "../types";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const me = await api<CurrentUser>("/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function login(email: string, password: string) {
    const me = await api<CurrentUser>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(me);
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
