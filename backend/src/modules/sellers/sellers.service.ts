import type { ApplySellerInput, SellerApplication, SellerApplicationStatus } from "@vista/shared";
import { AuthenticationError, AuthorizationError, ConflictError } from "../../errors/AppError";
import { toSellerApplication } from "./sellers.mapper";
import {
  SLUG_TAKEN_MESSAGE,
  type SellerApplicationData,
  type SellersRepository,
} from "./sellers.repository";

export interface SellersService {
  apply(userId: string, input: ApplySellerInput): Promise<SellerApplication>;
  getApplicationStatus(userId: string): Promise<SellerApplicationStatus>;
}

/**
 * قوانین کسب‌وکار (همه Server-side؛ userId فقط از توکن می‌آید):
 *  - فقط CUSTOMER می‌تواند اولین درخواست را بدهد (ADMIN و نقش‌های ناسازگار رد می‌شوند).
 *  - هر کاربر حداکثر یک Seller دارد (userId یکتاست).
 *  - PENDING / APPROVED → 409 (تکراری)، SUSPENDED → 403 (هرگز حساب جدید ساخته نمی‌شود).
 *  - REJECTED → ارسال مجدد مجاز است: همان رکورد با اطلاعات جدید به PENDING برمی‌گردد.
 *  - وضعیت همیشه PENDING است؛ تأیید فقط با مسیر ادمین (در آینده).
 */
export function createSellersService(repository: SellersRepository): SellersService {
  async function requireUserRole(userId: string) {
    const role = await repository.findUserRole(userId);
    if (!role) throw new AuthenticationError("حساب کاربری یافت نشد");
    return role;
  }

  return {
    async apply(userId, input) {
      const role = await requireUserRole(userId);
      if (role === "ADMIN") {
        throw new AuthorizationError("مدیر سیستم نمی‌تواند درخواست فروشندگی ثبت کند");
      }

      const data: SellerApplicationData = {
        storeName: input.storeName,
        storeSlug: input.storeSlug,
        description: input.description ?? null,
      };

      const existing = await repository.findByUserId(userId);

      if (existing) {
        switch (existing.status) {
          case "PENDING":
            throw new ConflictError("درخواست فروشندگی شما قبلاً ثبت شده و در انتظار بررسی است.");
          case "APPROVED":
            throw new ConflictError("فروشگاه شما قبلاً تأیید شده است.");
          case "SUSPENDED":
            throw new AuthorizationError("حساب فروشندگی شما تعلیق شده و امکان ثبت درخواست جدید نیست.");
          case "REJECTED":
            break; // ارسال مجدد؛ پایین‌تر
        }
      } else if (role !== "CUSTOMER") {
        // مثلاً SELLER بدون رکورد Seller: وضعیت ناسازگار است و نباید با درخواست عادی «ترمیم» شود
        throw new AuthorizationError("امکان ثبت درخواست فروشندگی برای این حساب وجود ندارد");
      }

      // بررسی زودهنگام برای پیام دقیق؛ مرجع نهایی همچنان Unique Constraint دیتابیس است
      if (await repository.isSlugTakenByOther(data.storeSlug, userId)) {
        throw new ConflictError(SLUG_TAKEN_MESSAGE, { storeSlug: [SLUG_TAKEN_MESSAGE] });
      }

      if (existing) {
        const updated = await repository.resubmitRejected(userId, data);
        if (!updated) {
          throw new ConflictError("وضعیت درخواست شما تغییر کرده است. صفحه را دوباره بارگذاری کنید.");
        }
        return toSellerApplication(updated);
      }

      return toSellerApplication(await repository.createPending(userId, data));
    },

    async getApplicationStatus(userId) {
      const role = await requireUserRole(userId);
      const existing = await repository.findByUserId(userId);

      if (!existing) {
        return { application: null, canApply: role === "CUSTOMER" };
      }
      return {
        application: toSellerApplication(existing),
        canApply: existing.status === "REJECTED" && role !== "ADMIN",
      };
    },
  };
}
