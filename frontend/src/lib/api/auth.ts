import type {
  AuthSession,
  AuthUser,
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
} from "@vista/shared";
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

  updateProfile: (input: UpdateProfileInput) =>
    apiRequest<AuthUser>("/auth/me", { method: "PATCH", auth: true, body: input }),

  /** نشست‌های قبلی باطل می‌شوند و نشست تازه (Access Token + Cookie جدید) برمی‌گردد */
  changePassword: (input: ChangePasswordInput) =>
    apiRequest<AuthSession>("/auth/change-password", { method: "POST", auth: true, body: input }),
};
