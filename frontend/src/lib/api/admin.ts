import type {
  AdminCategory,
  AdminDashboard,
  AdminOrderDetail,
  AdminOrderList,
  AdminProductDetail,
  AdminProductList,
  AdminSellerDetail,
  AdminSellerList,
  CreateCategoryInput,
  OrderStatus,
  ProductStatusValue,
  SellerStatus,
  UpdateCategoryInput,
} from "@vista/shared";
import { apiRequest } from "./client";

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export interface AdminSellersParams {
  page?: number;
  limit?: number;
  q?: string | undefined;
  status?: SellerStatus | undefined;
}
export interface AdminProductsParams {
  page?: number;
  limit?: number;
  q?: string | undefined;
  status?: ProductStatusValue | undefined;
  categoryId?: string | undefined;
  sellerId?: string | undefined;
  blockedSellers?: boolean | undefined;
}
export interface AdminOrdersParams {
  page?: number;
  limit?: number;
  q?: string | undefined;
  status?: OrderStatus | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

const id = encodeURIComponent;

/**
 * هویت ادمین هرگز در بدنه/Query ارسال نمی‌شود؛ Backend آن را فقط از توکن می‌خواند و نقش را از دیتابیس
 * بررسی می‌کند. هیچ Endpoint نوشتنی برای سفارش‌ها وجود ندارد (فقط خواندن).
 */
export const adminApi = {
  dashboard: () => apiRequest<AdminDashboard>("/admin/dashboard", { auth: true }),

  sellers: (params: AdminSellersParams = {}) =>
    apiRequest<AdminSellerList>(`/admin/sellers${qs({ ...params })}`, { auth: true }),
  seller: (sellerId: string) => apiRequest<AdminSellerDetail>(`/admin/sellers/${id(sellerId)}`, { auth: true }),
  changeSellerStatus: (sellerId: string, body: { status: "APPROVED" | "REJECTED" | "SUSPENDED"; reason?: string }) =>
    apiRequest<AdminSellerDetail>(`/admin/sellers/${id(sellerId)}/status`, { method: "PATCH", body, auth: true }),

  products: (params: AdminProductsParams = {}) =>
    apiRequest<AdminProductList>(`/admin/products${qs({ ...params })}`, { auth: true }),
  product: (productId: string) => apiRequest<AdminProductDetail>(`/admin/products/${id(productId)}`, { auth: true }),
  changeProductStatus: (productId: string, body: { status: "DRAFT" | "ARCHIVED"; reason: string }) =>
    apiRequest<AdminProductDetail>(`/admin/products/${id(productId)}/status`, { method: "PATCH", body, auth: true }),

  categories: (params: { q?: string | undefined; sort?: "order" | "name" | "products" | undefined } = {}) =>
    apiRequest<AdminCategory[]>(`/admin/categories${qs({ ...params })}`, { auth: true }),
  createCategory: (body: CreateCategoryInput) =>
    apiRequest<AdminCategory>("/admin/categories", { method: "POST", body, auth: true }),
  updateCategory: (categoryId: string, body: UpdateCategoryInput) =>
    apiRequest<AdminCategory>(`/admin/categories/${id(categoryId)}`, { method: "PATCH", body, auth: true }),
  deleteCategory: (categoryId: string) =>
    apiRequest<null>(`/admin/categories/${id(categoryId)}`, { method: "DELETE", auth: true }),

  orders: (params: AdminOrdersParams = {}) =>
    apiRequest<AdminOrderList>(`/admin/orders${qs({ ...params })}`, { auth: true }),
  order: (orderId: string) => apiRequest<AdminOrderDetail>(`/admin/orders/${id(orderId)}`, { auth: true }),
};
