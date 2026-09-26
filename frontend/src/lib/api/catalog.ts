import type {
  CatalogQuery,
  PaginatedResponse,
  ProductCardSummary,
  PublicProductDetail,
} from "@vista/shared";
import { apiRequest } from "./client";

/** بدون auth: هر بازدیدکننده‌ای (حتی مهمان) باید ببیندشان. */
export const catalogApi = {
  list: (query: Partial<CatalogQuery> = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    const qs = params.toString();
    return apiRequest<PaginatedResponse<ProductCardSummary>>(`/products${qs ? `?${qs}` : ""}`);
  },

  getBySlug: (slug: string) =>
    apiRequest<PublicProductDetail>(`/products/${encodeURIComponent(slug)}`),
};
