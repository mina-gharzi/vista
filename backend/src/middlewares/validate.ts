import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

type ValidationTarget = "body" | "query" | "params";

/**
 * Factory عمومی برای Validate کردن body/query/params با یک Zod Schema.
 * در صورت نامعتبر بودن، خطا به errorHandler مرکزی پاس داده می‌شود (ZodError آنجا مدیریت می‌شود).
 *
 * استفاده:
 *   router.post("/register", validate(registerSchema, "body"), authController.register)
 */
export function validate(schema: ZodSchema, target: ValidationTarget = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[target]);
      req[target] = parsed;
      next();
    } catch (err) {
      next(err);
    }
  };
}
