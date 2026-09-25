import { createHmac, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { USER_ROLES, type UserRole } from "@vista/shared";
import { env } from "../config/env";
import { AuthenticationError } from "../errors/AppError";

const ISSUER = "vista";

const accessPayloadSchema = z.object({
  sub: z.string().uuid(),
  role: z.enum(USER_ROLES),
});

export interface AccessTokenPayload {
  userId: string;
  role: UserRole;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign({ role: payload.role }, env.JWT_ACCESS_SECRET, {
    algorithm: "HS256",
    subject: payload.userId,
    issuer: ISSUER,
    // مقدار از Environment می‌آید (مثلاً "15m")؛ فرمت آن با jsonwebtoken سازگار است
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as NonNullable<jwt.SignOptions["expiresIn"]>,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ["HS256"],
      issuer: ISSUER,
    });
    const parsed = accessPayloadSchema.safeParse(decoded);
    if (!parsed.success) {
      throw new AuthenticationError("نشست نامعتبر است");
    }
    return { userId: parsed.data.sub, role: parsed.data.role };
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    throw new AuthenticationError("نشست نامعتبر یا منقضی شده است");
  }
}

/**
 * Refresh Token یک رشته تصادفی مبهم (Opaque) است، نه JWT: ۳۲ بایت CSPRNG.
 * در Database فقط HMAC-SHA256 آن (با JWT_REFRESH_SECRET به‌عنوان Pepper) ذخیره می‌شود؛
 * بنابراین لو رفتن Database به‌تنهایی برای جعل توکن کافی نیست.
 */
export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHmac("sha256", env.JWT_REFRESH_SECRET).update(token).digest("hex");
}
