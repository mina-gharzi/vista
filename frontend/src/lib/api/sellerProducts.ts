import type {
  CreateProductInput,
  PaginatedResponse,
  ProductStatus,
  SellerProduct,
  UpdateProductInput,
} from "@vista/shared";
import { apiRequest } from "./client";

export interface SellerProductsParams {
  page?: number;
  limit?: number;
  status?: ProductStatus | undefined;
  q?: string | undefined;
}

function toQueryString(params: SellerProductsParams): string {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  if (params.status) search.set("status", params.status);
  if (params.q) search.set("q", params.q);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/**
 * همه درخواست‌ها فقط با توکن کاربر هستند؛ sellerId هرگز از کلاینت ارسال نمی‌شود.
 * Backend فروشنده را از توکن پیدا می‌کند و مالکیت هر محصول را بررسی می‌کند.
 */
export const sellerProductsApi = {
  list: (params: SellerProductsParams = {}) =>
    apiRequest<PaginatedResponse<SellerProduct>>(`/seller/products${toQueryString(params)}`, {
      auth: true,
    }),
  get: (id: string) =>
    apiRequest<SellerProduct>(`/seller/products/${encodeURIComponent(id)}`, { auth: true }),
  create: (input: CreateProductInput) =>
    apiRequest<SellerProduct>("/seller/products", { method: "POST", body: input, auth: true }),
  update: (id: string, input: UpdateProductInput) =>
    apiRequest<SellerProduct>(`/seller/products/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: input,
      auth: true,
    }),
  setStatus: (id: string, status: ProductStatus) =>
    apiRequest<SellerProduct>(`/seller/products/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: { status },
      auth: true,
    }),
  /** «حذف» = آرشیو (حذف فیزیکی نداریم تا تاریخچه سفارش‌ها حفظ شود) */
  archive: (id: string) =>
    apiRequest<SellerProduct>(`/seller/products/${encodeURIComponent(id)}`, {
      method: "DELETE",
      auth: true,
    }),
};
