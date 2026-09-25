import type { CookieOptions, Response } from "express";
import { env } from "../../config/env";

export const REFRESH_COOKIE_NAME = "vista_refresh";

const baseOptions: CookieOptions = {
  httpOnly: true, // در دسترس JavaScript نیست (محافظت در برابر XSS)
  secure: env.NODE_ENV === "production",
  sameSite: "strict",
  // Cookie فقط به مسیرهای Auth ارسال می‌شود، نه به هر درخواست API
  path: "/api/auth",
};

export function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE_NAME, token, { ...baseOptions, expires: expiresAt });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, baseOptions);
}
