import type { NextFunction, Request, Response } from "express";
import { AppError, PayloadTooLargeError, ValidationError } from "../errors/AppError";
import { isZodError, toFieldErrors } from "../errors/zod";
import { logger } from "../utils/logger";
import type { ApiErrorResponse } from "@vista/shared";

/** خطاهایی که body-parser (داخل express.json) پرتاب می‌کند دارای فیلد `type` هستند. */
function getBodyParserErrorType(err: unknown): string | null {
  if (typeof err === "object" && err !== null && "type" in err && typeof err.type === "string") {
    return err.type;
  }
  return null;
}

function toAppError(err: unknown, req: Request): AppError {
  if (err instanceof AppError) {
    return err;
  }

  if (isZodError(err)) {
    return new ValidationError("داده‌های ارسالی معتبر نیستند", toFieldErrors(err));
  }

  const bodyParserType = getBodyParserErrorType(err);
  if (bodyParserType === "entity.parse.failed") {
    return new ValidationError("بدنه درخواست، JSON معتبر نیست");
  }
  if (bodyParserType === "entity.too.large") {
    return new PayloadTooLargeError();
  }

  // خطای پیش‌بینی‌نشده — فقط Log می‌شود و جزئیات هرگز به Client نمی‌رسد
  logger.error("Unhandled error", {
    message: err instanceof Error ? err.message : String(err),
    method: req.method,
    path: req.path,
  });
  return new AppError("خطای غیرمنتظره‌ای رخ داد", 500, "INTERNAL_SERVER_ERROR");
}

/**
 * آخرین Middleware در زنجیره Express. تمام Errorهای پرتاب‌شده در Route/Controller/Service
 * (چه به‌صورت مستقیم و چه از طریق next(err)) اینجا به یک پاسخ استاندارد تبدیل می‌شوند.
 * هیچ‌جای دیگر پروژه نباید مستقیماً res.status(...).json(...) برای خطا بنویسد.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // Express فقط با ۴ آرگومان این تابع را Error Handler می‌شناسد
  _next: NextFunction,
): void {
  const appError = toAppError(err, req);

  // خطاهای ۵xx که از AppError صریح آمده‌اند (مثلاً DatabaseError) هنوز Log نشده‌اند
  if (appError.statusCode >= 500 && err instanceof AppError) {
    logger.error(appError.message, { code: appError.code, method: req.method, path: req.path });
  }

  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details ? { details: appError.details } : {}),
    },
  };

  res.status(appError.statusCode).json(response);
}
