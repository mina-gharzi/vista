import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { AuthorizationError } from "../errors/AppError";

/**
 * دفاع لایه‌ای در برابر CSRF برای Endpointهایی که فقط به Cookie تکیه می‌کنند (Refresh/Logout).
 * علاوه بر SameSite=Strict، اگر مرورگر هدر Origin بفرستد باید دقیقاً Origin مجاز Frontend باشد.
 */
export function requireTrustedOrigin(req: Request, _res: Response, next: NextFunction): void {
  const origin = req.get("origin");
  if (origin !== undefined && origin !== env.CORS_ORIGIN) {
    next(new AuthorizationError("درخواست از مبدأ نامعتبر ارسال شده است"));
    return;
  }
  next();
}
