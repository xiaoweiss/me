import { request, setToken } from "./client";

export interface LoginResponse {
  token: string;
  name: string;
  status: "pending" | "active" | "disabled";
  hotelIds: number[];
}

export interface UserHotel {
  id: number;
  name: string;
}

export interface UserInfo {
  id: number;
  name: string;
  email: string;
  status: string;
  hotelIds: number[];
  hotels: UserHotel[];
  isAdmin: boolean;
  roleId: number;
  roleName: string;
  menus: string[];
}

/** 用钉钉免登授权码换取 JWT */
export async function loginWithDingTalk(code: string): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/dingtalk-login", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

/** 获取当前登录用户信息 */
export async function fetchCurrentUser(): Promise<UserInfo> {
  return request<UserInfo>("/api/auth/me");
}
