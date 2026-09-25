import type { Request, RequestHandler, Response } from "express";
import type { LoginInput, RegisterInput } from "@vista/shared";
import { getAuth } from "../../middlewares/requireAuth";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import { clearRefreshCookie, REFRESH_COOKIE_NAME, setRefreshCookie } from "./auth.cookies";
import type { AuthResult, AuthService } from "./auth.service";

function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE_NAME];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function respondWithSession(res: Response, result: AuthResult, status = 200): void {
  setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
  sendSuccess(res, result.session, status);
}

export interface AuthController {
  register: RequestHandler;
  login: RequestHandler;
  refresh: RequestHandler;
  logout: RequestHandler;
  me: RequestHandler;
}

export function createAuthController(service: AuthService): AuthController {
  return {
    // req.body قبلاً توسط validate(registerSchema) پاک‌سازی و Parse شده است
    register: asyncHandler(async (req, res) => {
      const input: RegisterInput = req.body;
      respondWithSession(res, await service.register(input), 201);
    }),

    login: asyncHandler(async (req, res) => {
      const input: LoginInput = req.body;
      respondWithSession(res, await service.login(input));
    }),

    refresh: asyncHandler(async (req, res) => {
      try {
        respondWithSession(res, await service.refresh(readRefreshCookie(req)));
      } catch (error) {
        // Cookie نامعتبر/منقضی بی‌فایده است؛ پاک می‌شود تا Client حلقه Refresh نزند
        clearRefreshCookie(res);
        throw error;
      }
    }),

    logout: asyncHandler(async (req, res) => {
      await service.logout(readRefreshCookie(req));
      clearRefreshCookie(res);
      sendSuccess(res, null);
    }),

    me: asyncHandler(async (req, res) => {
      sendSuccess(res, await service.getCurrentUser(getAuth(req).userId));
    }),
  };
}
