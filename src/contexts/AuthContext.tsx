import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getToken, setToken, clearToken, request } from "@/api/client";
import { loginWithDingTalk, fetchCurrentUser, type UserInfo } from "@/api/authApi";
import { getAuthCode, isDingTalkEnv } from "@/lib/dingtalk";

type AuthState =
  | { status: "loading" }
  | { status: "authenticated"; user: UserInfo }
  | { status: "error"; message: string }
  | { status: "pending"; name: string };

interface AuthContextType {
  auth: AuthState;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    initAuth();
  }, []);

  async function initAuth() {
    // 1. 已有 token → 尝试获取用户信息
    if (getToken()) {
      try {
        const user = await fetchCurrentUser();
        if (user.status === "pending") {
          setAuth({ status: "pending", name: user.name });
        } else {
          setAuth({ status: "authenticated", user });
        }
        return;
      } catch {
        clearToken();
      }
    }

    // 2. 在钉钉环境中 → 免登
    if (isDingTalkEnv()) {
      try {
        const code = await getAuthCode();
        console.log("[DEBUG] 免登 code:", code);

        const loginResp = await loginWithDingTalk(code);
        setToken(loginResp.token);

        if (loginResp.status === "pending") {
          setAuth({ status: "pending", name: loginResp.name });
        } else {
          const user = await fetchCurrentUser();
          setAuth({ status: "authenticated", user });
        }
      } catch (e) {
        setAuth({
          status: "error",
          message: e instanceof Error ? e.message : "免登失败",
        });
      }
      return;
    }

    // 3. 非钉钉环境 + 开发模式 → dev-token 自动登录
    if (import.meta.env.DEV) {
      try {
        const resp = await request<{
          token: string;
          name: string;
          status: string;
          hotelIds: number[];
        }>("/api/auth/dev-token");
        setToken(resp.token);
        const user = await fetchCurrentUser();
        setAuth({ status: "authenticated", user });
        console.log("[DEV] 自动登录成功:", user.name);
      } catch (e) {
        setAuth({
          status: "error",
          message: "开发模式登录失败，请确保后端在运行",
        });
      }
      return;
    }

    // 4. 非钉钉 + 非开发 → 提示
    setAuth({
      status: "error",
      message: "请在钉钉中打开本应用",
    });
  }

  function logout() {
    clearToken();
    setAuth({ status: "error", message: "已退出登录" });
  }

  return (
    <AuthContext.Provider value={{ auth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
