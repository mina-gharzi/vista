import type { PrismaClient } from "@prisma/client";
import type { SellerStatus, UserRole } from "@vista/shared";
import { ConflictError } from "../../errors/AppError";

export interface SellerRecord {
  storeName: string;
  storeSlug: string;
  description: string | null;
  status: SellerStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface SellerApplicationData {
  storeName: string;
  storeSlug: string;
  description: string | null;
}

export const SLUG_TAKEN_MESSAGE = "شناسه فروشگاه باید یکتا باشد.";
export const DUPLICATE_APPLICATION_MESSAGE = "درخواست فروشندگی شما قبلاً ثبت شده است.";

/** قرارداد دسترسی به داده فروشنده. Service فقط به این Interface وابسته است (قابل تست بدون Database). */
export interface SellersRepository {
  /** نقش «فعلی» کاربر از Database (نه از توکن که ممکن است کهنه باشد)؛ null یعنی کاربر وجود ندارد */
  findUserRole(userId: string): Promise<UserRole | null>;
  findByUserId(userId: string): Promise<SellerRecord | null>;
  /** آیا Slug متعلق به «فروشنده دیگری» است؟ (رکورد خود کاربر نادیده گرفته می‌شود) */
  isSlugTakenByOther(storeSlug: string, userId: string): Promise<boolean>;
  /** status همیشه PENDING است و پارامتر نیست. نقض Unique به ConflictError تبدیل می‌شود. */
  createPending(userId: string, data: SellerApplicationData): Promise<SellerRecord>;
  /**
   * اتمیک: فقط اگر رکورد «هنوز REJECTED» باشد اطلاعات را عوض و به PENDING برمی‌گرداند.
   * null یعنی وضعیت بین بررسی و نوشتن تغییر کرده (مثلاً Race با ادمین).
   */
  resubmitRejected(userId: string, data: SellerApplicationData): Promise<SellerRecord | null>;
}

interface PrismaKnownError {
  code: string;
  meta?: { target?: unknown };
}

function asPrismaError(error: unknown): PrismaKnownError | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    return error as PrismaKnownError;
  }
  return null;
}

/** تشخیص اینکه کدام Unique نقض شده: Slug (با پیام فیلد) یا userId (درخواست تکراری همزمان) */
function toConflict(error: unknown): ConflictError | null {
  const prismaError = asPrismaError(error);
  if (prismaError?.code !== "P2002") return null;

  const target = prismaError.meta?.target;
  const fields = Array.isArray(target) ? target.map(String) : [String(target ?? "")];
  if (fields.some((field) => field.includes("storeSlug"))) {
    return new ConflictError(SLUG_TAKEN_MESSAGE, { storeSlug: [SLUG_TAKEN_MESSAGE] });
  }
  return new ConflictError(DUPLICATE_APPLICATION_MESSAGE);
}

const SELLER_SELECT = {
  storeName: true,
  storeSlug: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function createSellersRepository(prisma: PrismaClient): SellersRepository {
  return {
    async findUserRole(userId) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      return user?.role ?? null;
    },

    findByUserId(userId) {
      return prisma.seller.findUnique({ where: { userId }, select: SELLER_SELECT });
    },

    async isSlugTakenByOther(storeSlug, userId) {
      const found = await prisma.seller.findFirst({
        where: { storeSlug, NOT: { userId } },
        select: { id: true },
      });
      return found !== null;
    },

    async createPending(userId, data) {
      try {
        return await prisma.seller.create({
          data: { userId, ...data, status: "PENDING" },
          select: SELLER_SELECT,
        });
      } catch (error) {
        // Race: Unique Constraint دیتابیس مرجع نهایی یکتایی Slug و «یک Seller برای هر کاربر» است
        throw toConflict(error) ?? error;
      }
    },

    async resubmitRejected(userId, data) {
      try {
        const { count } = await prisma.seller.updateMany({
          where: { userId, status: "REJECTED" },
          data: { ...data, status: "PENDING" },
        });
        if (count === 0) return null;
        return await prisma.seller.findUnique({ where: { userId }, select: SELLER_SELECT });
      } catch (error) {
        throw toConflict(error) ?? error;
      }
    },
  };
}
