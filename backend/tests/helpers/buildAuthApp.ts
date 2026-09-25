import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import { errorHandler } from "../../src/middlewares/errorHandler";
import { requireAuth, requireRole } from "../../src/middlewares/requireAuth";
import { createAuthController } from "../../src/modules/auth/auth.controller";
import { createAuthRouter } from "../../src/modules/auth/auth.routes";
import { createAuthService } from "../../src/modules/auth/auth.service";
import { FakeAuthRepository } from "./fakeAuthRepository";

export function buildAuthApp(now?: () => Date): { app: Express; repo: FakeAuthRepository } {
  const repo = new FakeAuthRepository();
  const service = createAuthService(repo, now);

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", createAuthRouter(createAuthController(service)));
  // Route نمونه برای تست RBAC
  app.get("/admin-only", requireAuth, requireRole("ADMIN"), (_req, res) => {
    res.json({ success: true, data: "secret" });
  });
  app.use(errorHandler);

  return { app, repo };
}

export const validRegistration = {
  fullName: "مینا تست",
  email: "mina@example.com",
  password: "Str0ngPassw0rd",
};

/** مقدار Cookie را از هدر Set-Cookie استخراج می‌کند */
export function extractRefreshCookie(setCookie: string[] | string | undefined): string | undefined {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const line = list.find((item) => item.startsWith("vista_refresh="));
  return line?.split(";")[0]?.split("=")[1];
}
