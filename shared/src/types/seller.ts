export const SELLER_STATUSES = ["PENDING", "APPROVED", "SUSPENDED", "REJECTED"] as const;
export type SellerStatus = (typeof SELLER_STATUSES)[number];

/**
 * درخواست/حساب فروشندگی کاربر جاری. عمداً شامل userId یا فیلدهای داخلی نیست.
 * (فیلد دلیل رد فعلاً در دیتابیس وجود ندارد؛ با ساخت پنل ادمین اضافه می‌شود.)
 */
export interface SellerApplication {
  storeName: string;
  storeSlug: string;
  description: string | null;
  status: SellerStatus;
  createdAt: string;
  updatedAt: string;
}

/** پاسخ GET /seller/application/status */
export interface SellerApplicationStatus {
  /** null یعنی کاربر هنوز درخواستی ثبت نکرده است */
  application: SellerApplication | null;
  /** آیا همین حالا مجاز به ارسال (یا ارسال مجدد) درخواست است؟ تصمیم نهایی همیشه با Backend است. */
  canApply: boolean;
}
