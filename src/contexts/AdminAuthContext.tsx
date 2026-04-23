import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getToken, setToken, clearToken, request } from "@/api/client";
import type { UserInfo } from "@/api/authApi";

type AdminAuthState =
  | { status: "loading" }
  | { status: "authenticated"; user: UserInfo }
  | { status: "unauthenticated" };

interface AdminAuthContextType {
  auth: AdminAuthState;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AdminAuthState>({ status: "loading" });

  useEffect(() => {
    initAuth();
  }, []);

  async function initAuth() {
    if (getToken()) {
      try {
        const user = await request<UserInfo>("/api/auth/me");
        if (user.isAdmin) {
          setAuth({ status: "authenticated", user });
          return;
        }
      } catch { /* token invalid */ }
      clearToken();
    }
    setAuth({ status: "unauthenticated" });
  }

  async function login(token: string) {
    setToken(token);
    const user = await request<UserInfo>("/api/auth/me");
    if (!user.isAdmin) { clearToken(); throw new Error("无管理员权限"); }
    setAuth({ status: "authenticated", user });
  }

  function logout() { clearToken(); setAuth({ status: "unauthenticated" }); }

  return (
    <AdminAuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be inside AdminAuthProvider");
  return ctx;
}
