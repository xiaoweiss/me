const API_BASE = import.meta.env.DEV
  ? "" // 开发模式用 Vite proxy
  : (import.meta.env.VITE_API_BASE_URL as string || "");

// H5（钉钉免登）和管理后台（用户名密码）是两条独立的登录通道，
// 必须用不同的 localStorage key 隔离，否则 dev-token 进来的 JWT 会让后台免登
let TOKEN_KEY = "auth_token";

/** 在入口（main.tsx / admin.tsx）最早调用一次，切换 token 存储命名空间 */
export function configureTokenKey(key: string) {
  TOKEN_KEY = key;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/** 带 JWT 的通用请求 */
export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearToken();
    throw new Error("登录已过期，请重新打开应用");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `请求失败: ${res.status}`);
  }

  return res.json();
}
