import { MAX_FILTER_PRICE, slugSchema, type CatalogQuery, type ProductSortOption } from "@vista/shared";

/**
 * وضعیت جستجو/فیلتر محصولات. «URL تنها منبع حقیقت» است: این ماژول URL را به یک شیء اعتبارسنجی‌شده
 * تبدیل می‌کند (پارامتر نامعتبر/ناسازگار بی‌صدا حذف می‌شود) و برعکس.
 */
export interface DiscoveryFilters {
  search: string;
  category: string;
  minPrice: number | null;
  maxPrice: number | null;
  seller: string;
  color: string;
  size: string;
  inStock: boolean;
  discounted: boolean;
  sort: ProductSortOption;
  page: number;
}

export const PAGE_SIZE = 24;
export const MAX_SEARCH_LENGTH = 100;

export const EMPTY_FILTERS: DiscoveryFilters = {
  search: "",
  category: "",
  minPrice: null,
  maxPrice: null,
  seller: "",
  color: "",
  size: "",
  inStock: false,
  discounted: false,
  sort: "newest",
  page: 1,
};

/** «تخفیف‌دار» به‌جای مرتب‌سازی، یک فیلتر است؛ مقدار قدیمی sort=discounted به فیلتر نگاشت می‌شود. */
export const SORT_OPTIONS: { value: Exclude<ProductSortOption, "discounted">; label: string }[] = [
  { value: "newest", label: "جدیدترین" },
  { value: "price_asc", label: "ارزان‌ترین" },
  { value: "price_desc", label: "گران‌ترین" },
];

interface ParamReader {
  get(name: string): string | null;
}

const toPrice = (raw: string | null): number | null => {
  if (raw === null || !/^\d{1,10}$/.test(raw)) return null;
  const value = Number(raw);
  return value <= MAX_FILTER_PRICE ? value : null;
};

const toSlug = (raw: string | null): string => (raw && slugSchema.safeParse(raw).success ? raw : "");
const toShortText = (raw: string | null): string => {
  const value = (raw ?? "").trim();
  return value.length > 0 && value.length <= 30 ? value : "";
};

export function parseDiscoveryParams(params: ParamReader): DiscoveryFilters {
  const rawSort = params.get("sort");
  const sort: DiscoveryFilters["sort"] =
    rawSort === "price_asc" || rawSort === "price_desc" ? rawSort : "newest";
  let minPrice = toPrice(params.get("minPrice"));
  let maxPrice = toPrice(params.get("maxPrice"));
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) maxPrice = null; // بازهٔ معکوس: سمت بالا حذف می‌شود
  if (minPrice === 0) minPrice = null; // صفر معادل «بدون حداقل» است
  const pageNumber = Number(params.get("page"));
  return {
    search: (params.get("search") ?? "").trim().slice(0, MAX_SEARCH_LENGTH),
    category: toSlug(params.get("category")),
    minPrice,
    maxPrice,
    seller: toSlug(params.get("seller")),
    color: toShortText(params.get("color")),
    size: toShortText(params.get("size")),
    inStock: params.get("inStock") === "true",
    discounted: params.get("discounted") === "true" || rawSort === "discounted",
    sort,
    page: Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= 10_000 ? pageNumber : 1,
  };
}

/** مقادیر پیش‌فرض در URL نمی‌آیند (آدرس کوتاه و یکتا). */
export function toSearchParams(filters: DiscoveryFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.category) params.set("category", filters.category);
  if (filters.minPrice !== null) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== null) params.set("maxPrice", String(filters.maxPrice));
  if (filters.seller) params.set("seller", filters.seller);
  if (filters.color) params.set("color", filters.color);
  if (filters.size) params.set("size", filters.size);
  if (filters.inStock) params.set("inStock", "true");
  if (filters.discounted) params.set("discounted", "true");
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params;
}

export function toApiQuery(filters: DiscoveryFilters): Partial<CatalogQuery> {
  return {
    page: filters.page,
    limit: PAGE_SIZE,
    sort: filters.sort,
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.minPrice !== null ? { minPrice: filters.minPrice } : {}),
    ...(filters.maxPrice !== null ? { maxPrice: filters.maxPrice } : {}),
    ...(filters.seller ? { seller: filters.seller } : {}),
    ...(filters.color ? { color: filters.color } : {}),
    ...(filters.size ? { size: filters.size } : {}),
    ...(filters.inStock ? { inStock: true } : {}),
    ...(filters.discounted ? { discounted: true } : {}),
  };
}

/** تعداد فیلترهای فعال (جستجو و مرتب‌سازی و صفحه جزو آن نیستند). */
export function activeFilterCount(f: DiscoveryFilters): number {
  return (
    (f.category ? 1 : 0) +
    (f.minPrice !== null || f.maxPrice !== null ? 1 : 0) +
    (f.seller ? 1 : 0) +
    (f.color ? 1 : 0) +
    (f.size ? 1 : 0) +
    (f.inStock ? 1 : 0) +
    (f.discounted ? 1 : 0)
  );
}

export function hasAnyCriteria(f: DiscoveryFilters): boolean {
  return f.search !== "" || activeFilterCount(f) > 0;
}
