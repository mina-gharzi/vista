import type {
  CatalogFilterOptions,
  CatalogQuery,
  PaginatedResponse,
  ProductCardSummary,
  PublicProductDetail,
} from "@vista/shared";
import { apiRequest } from "./client";

/** بدون auth: هر بازدیدکننده‌ای (حتی مهمان) باید ببیندشان. */
export const catalogApi = {
  /** signal: لغو سمت «کلاینت» (پاسخ کهنه دور ریخته می‌شود)؛ سرور درخواستِ در جریان را لزوماً متوقف نمی‌کند. */
  list: (query: Partial<CatalogQuery> = {}, options: { signal?: AbortSignal } = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    const qs = params.toString();
    return apiRequest<PaginatedResponse<ProductCardSummary>>(`/products${qs ? `?${qs}` : ""}`, {
      ...(options.signal ? { signal: options.signal } : {}),
    });
  },

  /** رنگ/سایز/بازهٔ قیمت در محدودهٔ دسته و جستجو (برای ساخت پنل فیلتر) */
  filterOptions: (query: { category?: string; search?: string } = {}, options: { signal?: AbortSignal } = {}) => {
    const params = new URLSearchParams();
    if (query.category) params.set("category", query.category);
    if (query.search) params.set("search", query.search);
    const qs = params.toString();
    return apiRequest<CatalogFilterOptions>(`/products/filters/options${qs ? `?${qs}` : ""}`, {
      ...(options.signal ? { signal: options.signal } : {}),
    });
  },

  getBySlug: (slug: string) =>
    apiRequest<PublicProductDetail>(`/products/${encodeURIComponent(slug)}`),
};
