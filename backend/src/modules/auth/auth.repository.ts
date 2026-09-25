import type { PrismaClient } from "@prisma/client";
import type { UserRole } from "@vista/shared";
import { ConflictError } from "../../errors/AppError";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  createdAt: Date;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface NewRefreshToken {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

/** قرارداد دسترسی به داده Auth. Service فقط به همین Interface وابسته است (قابل تست بدون Database). */
export interface AuthRepository {
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  /** role عمداً پارامتر نیست: کاربر جدید همیشه CUSTOMER است (جلوگیری از Mass Assignment) */
  createUser(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    phone: string | null;
  }): Promise<UserRecord>;
  createRefreshToken(data: NewRefreshToken): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null>;
  /** اتمیک: توکن قدیمی را Revoke و توکن جدید را می‌سازد. اگر توکن قدیمی از قبل Revoke شده باشد false. */
  rotateRefreshToken(oldId: string, next: NewRefreshToken): Promise<boolean>;
  revokeRefreshToken(tokenHash: string): Promise<void>;
  revokeAllUserTokens(userId: string): Promise<void>;
}

/** کد P2002 در Prisma یعنی نقض Unique Constraint (بررسی ساختاری، بدون وابستگی به کلاس Runtime). */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export function createAuthRepository(prisma: PrismaClient): AuthRepository {
  return {
    findUserByEmail(email) {
      return prisma.user.findUnique({ where: { email } });
    },

    findUserById(id) {
      return prisma.user.findUnique({ where: { id } });
    },

    async createUser(data) {
      try {
        return await prisma.user.create({ data });
      } catch (error) {
        // Race: دو Register همزمان با یک ایمیل — Unique Constraint دیتابیس مرجع نهایی است
        if (isUniqueViolation(error)) {
          throw new ConflictError("این ایمیل قبلاً ثبت شده است");
        }
        throw error;
      }
    },

    async createRefreshToken(data) {
      await prisma.refreshToken.create({ data });
    },

    findRefreshToken(tokenHash) {
      return prisma.refreshToken.findUnique({
        where: { tokenHash },
        select: { id: true, userId: true, expiresAt: true, revokedAt: true },
      });
    },

    rotateRefreshToken(oldId, next) {
      return prisma.$transaction(async (tx) => {
        // شرط revokedAt: null تضمین می‌کند دو Refresh همزمان با یک توکن هر دو موفق نشوند
        const { count } = await tx.refreshToken.updateMany({
          where: { id: oldId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        if (count === 0) return false;
        await tx.refreshToken.create({ data: next });
        return true;
      });
    },

    async revokeRefreshToken(tokenHash) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    },

    async revokeAllUserTokens(userId) {
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    },
  };
}
