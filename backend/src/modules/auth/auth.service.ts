import type { AuthSession, AuthUser, LoginInput, RegisterInput } from "@vista/shared";
import { env } from "../../config/env";
import { AuthenticationError, ConflictError } from "../../errors/AppError";
import { getDummyHash, hashPassword, verifyPassword } from "../../utils/password";
import { generateRefreshToken, hashRefreshToken, signAccessToken } from "../../utils/tokens";
import type { AuthRepository, UserRecord } from "./auth.repository";

/** اگر توکن Revoke‌شده در این بازه دوباره ارائه شود، Race بین دو Tab فرض می‌شود نه سرقت توکن. */
const REUSE_GRACE_MS = 10_000;

export interface AuthResult {
  session: AuthSession;
  /** فقط برای ست‌کردن Cookie توسط Controller؛ هرگز در Body پاسخ نمی‌آید */
  refreshToken: string;
  refreshExpiresAt: Date;
}

export function toAuthUser(user: UserRecord): AuthUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

export type AuthService = ReturnType<typeof createAuthService>;

export function createAuthService(repo: AuthRepository, now: () => Date = () => new Date()) {
  async function startSession(
    user: UserRecord,
    existingRefresh?: { oldId: string },
  ): Promise<AuthResult> {
    const { token, hash } = generateRefreshToken();
    const refreshExpiresAt = new Date(
      now().getTime() + env.JWT_REFRESH_EXPIRES_IN_DAYS * 86_400_000,
    );
    const next = { userId: user.id, tokenHash: hash, expiresAt: refreshExpiresAt };

    if (existingRefresh) {
      const rotated = await repo.rotateRefreshToken(existingRefresh.oldId, next);
      if (!rotated) throw new AuthenticationError("نشست منقضی شده است. دوباره وارد شوید");
    } else {
      await repo.createRefreshToken(next);
    }

    return {
      session: {
        accessToken: signAccessToken({ userId: user.id, role: user.role }),
        user: toAuthUser(user),
      },
      refreshToken: token,
      refreshExpiresAt,
    };
  }

  return {
    async register(input: RegisterInput): Promise<AuthResult> {
      const existing = await repo.findUserByEmail(input.email);
      if (existing) {
        throw new ConflictError("این ایمیل قبلاً ثبت شده است");
      }

      const user = await repo.createUser({
        email: input.email,
        passwordHash: await hashPassword(input.password),
        fullName: input.fullName,
        phone: input.phone ?? null,
      });
      return startSession(user);
    },

    async login(input: LoginInput): Promise<AuthResult> {
      const user = await repo.findUserByEmail(input.email);
      // حتی اگر کاربر نباشد Argon2 اجرا می‌شود تا زمان پاسخ ایمیل موجود/ناموجود یکسان بماند
      const valid = await verifyPassword(
        user?.passwordHash ?? (await getDummyHash()),
        input.password,
      );

      if (!user || !valid) {
        throw new AuthenticationError("ایمیل یا رمز عبور نادرست است");
      }
      return startSession(user);
    },

    async refresh(refreshToken: string | undefined): Promise<AuthResult> {
      if (!refreshToken) {
        throw new AuthenticationError("نشست یافت نشد. دوباره وارد شوید");
      }

      const record = await repo.findRefreshToken(hashRefreshToken(refreshToken));
      if (!record) {
        throw new AuthenticationError("نشست نامعتبر است. دوباره وارد شوید");
      }

      if (record.revokedAt) {
        // استفاده مجدد از توکن Revoke‌شده = احتمال سرقت → تمام نشست‌های کاربر باطل می‌شود
        if (now().getTime() - record.revokedAt.getTime() > REUSE_GRACE_MS) {
          await repo.revokeAllUserTokens(record.userId);
        }
        throw new AuthenticationError("نشست نامعتبر است. دوباره وارد شوید");
      }

      if (record.expiresAt.getTime() <= now().getTime()) {
        throw new AuthenticationError("نشست منقضی شده است. دوباره وارد شوید");
      }

      const user = await repo.findUserById(record.userId);
      if (!user) {
        throw new AuthenticationError("نشست نامعتبر است. دوباره وارد شوید");
      }
      return startSession(user, { oldId: record.id });
    },

    /** Idempotent: بدون توکن یا با توکن ناشناخته هم موفق است. */
    async logout(refreshToken: string | undefined): Promise<void> {
      if (!refreshToken) return;
      await repo.revokeRefreshToken(hashRefreshToken(refreshToken));
    },

    async getCurrentUser(userId: string): Promise<AuthUser> {
      const user = await repo.findUserById(userId);
      if (!user) {
        throw new AuthenticationError("حساب کاربری یافت نشد");
      }
      return toAuthUser(user);
    },
  };
}
