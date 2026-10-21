"use client";

import type { CatalogFilterOptions, PaginatedResponse, ProductCardSummary } from "@vista/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { catalogApi } from "@/lib/api/catalog";
import { toApiQuery, toSearchParams, type DiscoveryFilters } from "@/lib/utils/discoveryState";

export type ProductPage = PaginatedResponse<ProductCardSummary>;

export interface SearchState {
  phase: "loading" | "ready" | "error";
  /** آخرین نتیجهٔ موفق؛ هنگام بارگذاری نتیجهٔ بعدی همچنان نمایش داده می‌شود تا صفحه نپرد. */
  result: ProductPage | null;
}

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

/**
 * هر تغییر URL یک درخواست جدید می‌سازد؛ درخواست قبلی هم Abort می‌شود (سمت کلاینت) و هم با پرچم
 * `cancelled` نادیده گرفته می‌شود، پس پاسخ کهنه هرگز نتیجهٔ جدیدتر را بازنویسی نمی‌کند.
 * `initial`: نتیجهٔ SSR برای همان URL — درخواست اول را حذف می‌کند.
 */
export function useProductSearch(filters: DiscoveryFilters, initial: { key: string; result: ProductPage } | null) {
  const key = toSearchParams(filters).toString();
  const [state, setState] = useState<SearchState>(() =>
    initial && initial.key === key ? { phase: "ready", result: initial.result } : { phase: "loading", result: null },
  );
  const [version, setVersion] = useState(0);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const skipKey = useRef<string | null>(initial?.key === key ? key : null);

  useEffect(() => {
    if (skipKey.current === key && version === 0) {
      skipKey.current = null;
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    setState((s) => ({ phase: "loading", result: s.result }));
    catalogApi
      .list(toApiQuery(filtersRef.current), { signal: controller.signal })
      .then((result) => {
        if (!cancelled) setState({ phase: "ready", result });
      })
      .catch((error: unknown) => {
        if (cancelled || isAbort(error)) return;
        setState((s) => ({ phase: "error", result: s.result }));
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [key, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { state, reload };
}

/** گزینه‌های فیلتر؛ شکست آن مانع نمایش محصولات نیست (فقط چیپ‌های رنگ/سایز نمایش داده نمی‌شوند). */
export function useFilterOptions(category: string, search: string) {
  const [options, setOptions] = useState<CatalogFilterOptions | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    catalogApi
      .filterOptions({ ...(category ? { category } : {}), ...(search ? { search } : {}) }, { signal: controller.signal })
      .then((next) => {
        if (!cancelled) setOptions(next);
      })
      .catch(() => {
        if (!cancelled) setOptions(null);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [category, search]);
  return options;
}
