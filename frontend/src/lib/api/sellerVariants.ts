import type {
  CreateVariantInput,
  ProductVariantSummary,
  SyncVariantsInput,
  UpdateVariantInput,
} from "@vista/shared";
import { apiRequest } from "./client";

const base = (productId: string) => `/seller/products/${encodeURIComponent(productId)}/variants`;

/**
 * هیچ sellerId ای ارسال نمی‌شود؛ Backend مالکیت محصول و تنوع را از توکن کاربر بررسی می‌کند.
 * «حذف» = آرشیو (تاریخچه سفارش و انبار حفظ می‌شود).
 */
export const sellerVariantsApi = {
  list: (productId: string) =>
    apiRequest<ProductVariantSummary[]>(base(productId), { auth: true }),
  create: (productId: string, input: CreateVariantInput) =>
    apiRequest<ProductVariantSummary>(base(productId), { method: "POST", body: input, auth: true }),
  update: (productId: string, variantId: string, input: UpdateVariantInput) =>
    apiRequest<ProductVariantSummary>(`${base(productId)}/${encodeURIComponent(variantId)}`, {
      method: "PATCH",
      body: input,
      auth: true,
    }),
  archive: (productId: string, variantId: string) =>
    apiRequest<ProductVariantSummary>(`${base(productId)}/${encodeURIComponent(variantId)}`, {
      method: "DELETE",
      auth: true,
    }),
  /** ذخیره اتمیک Variant Builder: مجموعه کامل تنوع‌های فعال */
  sync: (productId: string, input: SyncVariantsInput) =>
    apiRequest<ProductVariantSummary[]>(base(productId), { method: "PUT", body: input, auth: true }),
};
