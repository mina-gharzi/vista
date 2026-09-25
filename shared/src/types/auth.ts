export const USER_ROLES = ["CUSTOMER", "SELLER", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** اطلاعات عمومی کاربر که به Client برگردانده می‌شود (هرگز شامل passwordHash نیست). */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  createdAt: string;
}

/** پاسخ Register / Login / Refresh. Refresh Token فقط در httpOnly Cookie است، نه در Body. */
export interface AuthSession {
  accessToken: string;
  user: AuthUser;
}
