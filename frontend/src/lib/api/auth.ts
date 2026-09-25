import type { AuthSession, AuthUser, LoginInput, RegisterInput } from "@vista/shared";
import { apiRequest } from "./client";

/** فقط Wrapperهای Endpointهای Auth؛ منطق Session در lib/auth/session.ts است. */
export const authApi = {
  register: (input: RegisterInput) =>
    apiRequest<AuthSession>("/auth/register", { method: "POST", body: input }),

  login: (input: LoginInput) =>
    apiRequest<AuthSession>("/auth/login", { method: "POST", body: input }),

  /** با httpOnly Refresh Cookie کار می‌کند؛ Body ندارد */
  refresh: () => apiRequest<AuthSession>("/auth/refresh", { method: "POST" }),

  logout: () => apiRequest<null>("/auth/logout", { method: "POST" }),

  me: () => apiRequest<AuthUser>("/auth/me", { auth: true }),
};
