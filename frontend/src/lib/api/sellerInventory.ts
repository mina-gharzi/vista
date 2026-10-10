import type {
  AdjustStockInput,
  InventoryMovementsResult,
  InventoryMutationResult,
  RestockInput,
  SellerInventoryList,
  StockStatus,
} from "@vista/shared";
import { apiRequest } from "./client";

export interface SellerInventoryParams {
  page?: number;
  limit?: number;
  status?: StockStatus | undefined;
  q?: string | undefined;
}

function toQueryString(params: { page?: number | undefined; limit?: number | undefined; status?: string | undefined; q?: string | undefined }): string {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  if (params.status) search.set("status", params.status);
  if (params.q) search.set("q", params.q);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

const base = "/seller/inventory";

/**
 * هیچ sellerId/actorId ای ارسال نمی‌شود؛ Backend فروشنده را از توکن می‌یابد و مالکیت Variant را
 * داخل خود Transaction بررسی می‌کند. موجودی فقط از طریق این دو عملیات (با دلیل) تغییر می‌کند.
 */
export const sellerInventoryApi = {
  list: (params: SellerInventoryParams = {}) =>
    apiRequest<SellerInventoryList>(`${base}${toQueryString(params)}`, { auth: true }),
  movements: (variantId: string, params: { page?: number; limit?: number } = {}) =>
    apiRequest<InventoryMovementsResult>(
      `${base}/${encodeURIComponent(variantId)}/movements${toQueryString(params)}`,
      { auth: true },
    ),
  restock: (variantId: string, input: RestockInput) =>
    apiRequest<InventoryMutationResult>(`${base}/${encodeURIComponent(variantId)}/restock`, {
      method: "POST",
      body: input,
      auth: true,
    }),
  adjust: (variantId: string, input: AdjustStockInput) =>
    apiRequest<InventoryMutationResult>(`${base}/${encodeURIComponent(variantId)}/adjust`, {
      method: "POST",
      body: input,
      auth: true,
    }),
};
