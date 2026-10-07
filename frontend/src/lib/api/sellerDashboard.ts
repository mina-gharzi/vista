import type { SellerDashboard } from "@vista/shared";
import { apiRequest } from "./client";

/**
 * یک درخواست تجمیعی برای کل داشبورد. هیچ sellerId ای ارسال نمی‌شود:
 * Backend فروشنده را از توکن کاربر پیدا می‌کند و فقط برای فروشنده APPROVED پاسخ می‌دهد.
 */
export const sellerDashboardApi = {
  get: () => apiRequest<SellerDashboard>("/seller/dashboard", { auth: true }),
};
