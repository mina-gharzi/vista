import rateLimit from "express-rate-limit";
import { AppError } from "../errors/AppError";
import { env } from "../config/env";

interface LimiterOptions {
  windowMs: number;
  limit: number;
}

/** Rate Limiter با پاسخ خطای استاندارد (همان ساختار ApiErrorResponse). در تست‌ها غیرفعال است. */
export function createRateLimiter({ windowMs, limit }: LimiterOptions) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.NODE_ENV === "test",
    handler: (_req, _res, next) => {
      next(
        new AppError(
          "تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.",
          429,
          "RATE_LIMITED",
        ),
      );
    },
  });
}
