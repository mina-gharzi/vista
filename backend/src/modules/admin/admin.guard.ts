import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { PrismaClient } from "@prisma/client";
import type { UserRole } from "@vista/shared";
import { AuthenticationError, AuthorizationError } from "../../errors/AppError";
import { requireAuth } from "../../middlewares/requireAuth";

export type FindUserRole = (userId: string) => Promise<UserRole | null>;

export function createFindUserRole(prisma: PrismaClient): FindUserRole {
  return async (userId) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    return user?.role ?? null;
  };
}

/**
 * دسترسی ادمین = «نقش ADMIN در دیتابیس» در لحظهٔ همین درخواست.
 * نقش داخل توکن عمداً نادیده گرفته می‌شود: ادمینِ عزل‌شده بلافاصله دسترسی را از دست می‌دهد و
 * توکن قدیمی/دست‌کاری‌شده نمی‌تواند ادمین شود. پیام خطا یکسان و بدون جزئیات داخلی است.
 */
export function createRequireAdmin(findUserRole: FindUserRole): RequestHandler[] {
  const checkAdmin = (req: Request, _res: Response, next: NextFunction): void => {
    const userId = req.auth?.userId;
    if (!userId) {
      next(new AuthenticationError("برای دسترسی باید وارد حساب کاربری شوید"));
      return;
    }
    findUserRole(userId).then((role) => {
      if (role === null) next(new AuthenticationError("برای دسترسی باید وارد حساب کاربری شوید"));
      else if (role !== "ADMIN") next(new AuthorizationError());
      else next();
    }, next);
  };
  return [requireAuth, checkAdmin];
}
