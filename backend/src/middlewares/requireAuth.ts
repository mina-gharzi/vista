import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@vista/shared";
import { AuthenticationError, AuthorizationError } from "../errors/AppError";
import { verifyAccessToken } from "../utils/tokens";

/** Access Token را از هدر `Authorization: Bearer <token>` می‌خواند و req.auth را پر می‌کند. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.get("authorization");
  const [scheme, token] = header?.split(" ") ?? [];

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    next(new AuthenticationError("برای دسترسی باید وارد حساب کاربری شوید"));
    return;
  }

  try {
    const { userId, role } = verifyAccessToken(token);
    req.auth = { userId, role };
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * مثل requireAuth ولی هیچ‌وقت رد نمی‌کند — برای Endpointهای عمومی که رفتارشان بسته به «کاربر واردشده
 * است یا نه» کمی فرق می‌کند (مثلاً نمایش دکمه ویرایش روی ریویوی خودِ کاربر در فهرست عمومی ریویوها).
 * توکن نامعتبر/منقضی هم مثل نبودن توکن با آن رفتار می‌شود (req.auth پر نمی‌شود)، نه خطا.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.get("authorization");
  const [scheme, token] = header?.split(" ") ?? [];

  if (scheme?.toLowerCase() === "bearer" && token) {
    try {
      const { userId, role } = verifyAccessToken(token);
      req.auth = { userId, role };
    } catch {
      // توکن نامعتبر در مسیر عمومی نباید کل درخواست را رد کند؛ فقط به‌عنوان «مهمان» ادامه می‌دهیم
    }
  }

  next();
}

/** باید بعد از requireAuth استفاده شود. Authorization در Backend اعمال می‌شود، نه Frontend. */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new AuthenticationError("برای دسترسی باید وارد حساب کاربری شوید"));
      return;
    }
    if (!roles.includes(req.auth.role)) {
      next(new AuthorizationError());
      return;
    }
    next();
  };
}

/** برای Controllerها: مطمئن می‌شود requireAuth اجرا شده و مقدار را Non-optional برمی‌گرداند. */
export function getAuth(req: Request): { userId: string; role: UserRole } {
  if (!req.auth) {
    throw new AuthenticationError("برای دسترسی باید وارد حساب کاربری شوید");
  }
  return req.auth;
}
