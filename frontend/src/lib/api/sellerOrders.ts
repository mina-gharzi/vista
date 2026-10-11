import type {
  FulfillmentStatus,
  SellerOrderDetail,
  SellerOrderList,
  SellerOrdersOverview,
  UpdateSellerOrderStatusInput,
} from "@vista/shared";
import { apiRequest } from "./client";

export interface SellerOrdersParams {
  page?: number;
  limit?: number;
  status?: FulfillmentStatus | undefined;
  from?: string | undefined;
  to?: string | undefined;
  q?: string | undefined;
}

function toQueryString(params: SellerOrdersParams): string {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  if (params.status) search.set("status", params.status);
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  if (params.q) search.set("q", params.q);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

const base = "/seller/orders";

/**
 * هیچ sellerId/actorId ای ارسال نمی‌شود؛ Backend فروشنده را از توکن می‌یابد و مالکیت هر سفارش را در
 * خود Query بررسی می‌کند. تنها چیزی که فروشنده می‌تواند تغییر دهد «وضعیت ارسال» (و کد رهگیری) است.
 */
export const sellerOrdersApi = {
  list: (params: SellerOrdersParams = {}) =>
    apiRequest<SellerOrderList>(`${base}${toQueryString(params)}`, { auth: true }),
  overview: () => apiRequest<SellerOrdersOverview>(`${base}/summary`, { auth: true }),
  detail: (sellerOrderId: string) =>
    apiRequest<SellerOrderDetail>(`${base}/${encodeURIComponent(sellerOrderId)}`, { auth: true }),
  updateStatus: (sellerOrderId: string, input: UpdateSellerOrderStatusInput) =>
    apiRequest<SellerOrderDetail>(`${base}/${encodeURIComponent(sellerOrderId)}/status`, {
      method: "PATCH",
      body: input,
      auth: true,
    }),
};
