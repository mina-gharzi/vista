import { Router } from "express";
import { createRateLimiter } from "../../middlewares/rateLimit";
import { requireAuth } from "../../middlewares/requireAuth";
import { requireTrustedOrigin } from "../../middlewares/requireTrustedOrigin";
import { validate } from "../../middlewares/validate";
import type { AuthController } from "./auth.controller";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from "./auth.validator";

export function createAuthRouter(controller: AuthController): Router {
  const router = Router();

  // محدودیت سخت‌گیرانه‌تر برای مسیرهای حساس (Brute-force / سوءاستفاده)
  const credentialsLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, limit: 10 });
  const refreshLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, limit: 60 });

  router.post(
    "/register",
    credentialsLimiter,
    validate(registerSchema, "body"),
    controller.register,
  );
  router.post("/login", credentialsLimiter, validate(loginSchema, "body"), controller.login);
  router.post("/refresh", refreshLimiter, requireTrustedOrigin, controller.refresh);
  router.post("/logout", requireTrustedOrigin, controller.logout);
  router.get("/me", requireAuth, controller.me);
  router.patch("/me", requireAuth, validate(updateProfileSchema, "body"), controller.updateMe);
  router.post(
    "/change-password",
    credentialsLimiter,
    requireAuth,
    requireTrustedOrigin,
    validate(changePasswordSchema, "body"),
    controller.changePassword,
  );

  return router;
}
