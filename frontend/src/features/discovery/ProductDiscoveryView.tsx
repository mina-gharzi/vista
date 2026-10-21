"use client";

import type { CategoryNode } from "@vista/shared";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Button, EmptyState, ErrorState, Input, Modal, Pagination, Select, Skeleton } from "@/components/ui";
import { ProductGrid } from "@/components/product/ProductGrid";
import { categoriesApi } from "@/lib/api/categories";
import { formatNumber, formatPrice } from "@/lib/utils/format";
import {
  activeFilterCount,
  EMPTY_FILTERS,
  hasAnyCriteria,
  parseDiscoveryParams,
  SORT_OPTIONS,
  toSearchParams,
  type DiscoveryFilters,
} from "@/lib/utils/discoveryState";
import { FilterPanel, flattenCategories } from "./FilterPanel";
import { useFilterOptions, useProductSearch, type ProductPage } from "./useProductSearch";

export const SEARCH_DEBOUNCE_MS = 350;

function GridSkeleton() {
  return (
    <div aria-busy="true" aria-label="در حال بارگذاری محصولات" className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-lg border border-border bg-ivory-soft p-3">
          <Skeleton className="aspect-[3/4] w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

interface Props {
  /** نتیجهٔ SSR برای همان URL (اختیاری) */
  initial?: { key: string; result: ProductPage } | null;
}

export function ProductDiscoveryView({ initial = null }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = useMemo(() => parseDiscoveryParams(params), [params]);
  const { state, reload } = useProductSearch(filters, initial);
  const options = useFilterOptions(filters.category, filters.search);

  const [categories, setCategories] = useState<{ slug: string; label: string }[]>([]);
  useEffect(() => {
    let cancelled = false;
    categoriesApi
      .getTree()
      .then((tree: CategoryNode[]) => {
        if (!cancelled) setCategories(flattenCategories(tree));
      })
      .catch(() => undefined); // بدون دسته‌ها هم جستجو کار می‌کند
    return () => {
      cancelled = true;
    };
  }, []);

  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const navigate = (next: DiscoveryFilters, mode: "push" | "replace" = "push") => {
    const qs = toSearchParams(next).toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    if (mode === "push") router.push(url, { scroll: false });
    else router.replace(url, { scroll: false });
  };

  // ───── جستجو: متن محلی + Debounce (replace تا تاریخچه با هر حرف پر نشود) ─────
  const [searchText, setSearchText] = useState(filters.search);
  const lastSyncedSearch = useRef(filters.search);
  useEffect(() => {
    // Back/Forward: وقتی URL تغییر کرد و خودمان آن را نساخته‌ایم، ورودی با URL هماهنگ می‌شود
    if (filters.search !== lastSyncedSearch.current) {
      lastSyncedSearch.current = filters.search;
      setSearchText(filters.search);
    }
  }, [filters.search]);

  useEffect(() => {
    const trimmed = searchText.trim();
    if (trimmed === filtersRef.current.search) return;
    const timer = setTimeout(() => {
      lastSyncedSearch.current = trimmed;
      navigate({ ...filtersRef.current, search: trimmed, page: 1 }, "replace");
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- navigate فقط از ref و router استفاده می‌کند
  }, [searchText]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = searchText.trim();
    lastSyncedSearch.current = trimmed;
    navigate({ ...filters, search: trimmed, page: 1 }, "push");
  };

  const applyPatch = (patch: Partial<DiscoveryFilters>) => navigate({ ...filters, ...patch, page: 1 });
  const clearAll = () => {
    setSearchText("");
    lastSyncedSearch.current = "";
    navigate({ ...EMPTY_FILTERS, sort: filters.sort });
  };

  // ───── منوی فیلتر موبایل (پیش‌نویس تا زمان «اعمال») ─────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<DiscoveryFilters>(filters);
  // با هر باز/پاک‌شدن، ورودی‌های قیمت از پیش‌نویس تازه ساخته می‌شوند (نه با هر حرف، تا فوکوس نپرد)
  const [drawerKey, setDrawerKey] = useState(0);
  const openDrawer = () => {
    setDraft(filters);
    setDrawerKey((k) => k + 1);
    setDrawerOpen(true);
  };

  const result = state.result;
  const sellerName = result?.data.find((p) => p.sellerStoreSlug === filters.seller)?.sellerStoreName;
  const categoryLabel = categories.find((c) => c.slug === filters.category)?.label.replace(/^(— )+/, "");

  const chips: { key: string; label: string; remove: Partial<DiscoveryFilters> }[] = [];
  if (filters.category) chips.push({ key: "category", label: `دسته: ${categoryLabel ?? filters.category}`, remove: { category: "" } });
  if (filters.minPrice !== null || filters.maxPrice !== null) {
    const from = filters.minPrice !== null ? `از ${formatPrice(filters.minPrice)}` : "";
    const to = filters.maxPrice !== null ? `تا ${formatPrice(filters.maxPrice)}` : "";
    chips.push({ key: "price", label: `قیمت: ${[from, to].filter(Boolean).join(" ")}`, remove: { minPrice: null, maxPrice: null } });
  }
  if (filters.seller) chips.push({ key: "seller", label: `فروشگاه: ${sellerName ?? filters.seller}`, remove: { seller: "" } });
  if (filters.color) chips.push({ key: "color", label: `رنگ: ${filters.color}`, remove: { color: "" } });
  if (filters.size) chips.push({ key: "size", label: `سایز: ${filters.size}`, remove: { size: "" } });
  if (filters.inStock) chips.push({ key: "inStock", label: "فقط موجود", remove: { inStock: false } });
  if (filters.discounted) chips.push({ key: "discounted", label: "تخفیف‌دار", remove: { discounted: false } });

  const filterCount = activeFilterCount(filters);
  const loading = state.phase === "loading";

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="type-h1 mb-6">محصولات</h1>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end">
        <form role="search" aria-label="جستجوی محصولات" onSubmit={submitSearch} className="flex flex-1 items-end gap-2">
          <div className="flex-1">
            <Input
              label="جستجو"
              name="search"
              type="search"
              autoComplete="off"
              maxLength={100}
              placeholder="نام محصول، توضیحات یا دسته…"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary">
            جستجو
          </Button>
        </form>
        <div className="w-full sm:w-48">
          <Select label="مرتب‌سازی" value={filters.sort} onChange={(event) => applyPatch({ sort: event.target.value as DiscoveryFilters["sort"] })}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <Button type="button" variant="secondary" className="lg:hidden" onClick={openDrawer} aria-haspopup="dialog">
          فیلترها{filterCount > 0 ? ` (${formatNumber(filterCount)})` : ""}
        </Button>
      </div>

      {(chips.length > 0 || filters.search) && (
        <div className="mb-6 flex flex-wrap items-center gap-2" aria-label="فیلترهای فعال" role="group">
          {filters.search && (
            <button
              type="button"
              aria-label={`حذف جستجوی ${filters.search}`}
              onClick={() => {
                setSearchText("");
                lastSyncedSearch.current = "";
                navigate({ ...filters, search: "", page: 1 });
              }}
              className="rounded-full border border-border bg-ivory-soft px-3 py-1 text-sm hover:border-ink"
            >
              جستجو: {filters.search} ✕
            </button>
          )}
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              aria-label={`حذف فیلتر ${chip.label}`}
              onClick={() => applyPatch(chip.remove)}
              className="rounded-full border border-border bg-ivory-soft px-3 py-1 text-sm hover:border-ink"
            >
              {chip.label} ✕
            </button>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
            پاک‌کردن همه
          </Button>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside aria-label="فیلترها" className="hidden lg:block">
          <FilterPanel
            key={`${filters.minPrice}-${filters.maxPrice}`}
            idPrefix="side"
            value={filters}
            onChange={applyPatch}
            categories={categories}
            options={options}
            immediate
          />
        </aside>

        <section aria-label="نتایج" aria-busy={loading}>
          <p role="status" aria-live="polite" className="mb-4 text-sm text-ink-muted">
            {result && state.phase !== "error" ? `${formatNumber(result.pagination.total)} محصول` : " "}
          </p>

          {state.phase === "error" ? (
            <ErrorState title="دریافت محصولات انجام نشد" description="ارتباط با سرور برقرار نشد یا خطایی رخ داد. دوباره تلاش کنید." onRetry={reload} />
          ) : result === null ? (
            <GridSkeleton />
          ) : result.data.length === 0 && !loading ? (
            <EmptyState
              title="محصولی پیدا نشد"
              description={hasAnyCriteria(filters) ? "عبارت جستجو یا فیلترها را تغییر دهید." : "هنوز محصولی منتشر نشده است."}
              action={hasAnyCriteria(filters) ? <Button onClick={clearAll}>پاک‌کردن جستجو و فیلترها</Button> : undefined}
            />
          ) : (
            <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
              <ProductGrid products={result.data} />
              <Pagination
                page={result.pagination.page}
                totalPages={result.pagination.totalPages}
                onPageChange={(page) => navigate({ ...filters, page })}
                className="mt-10"
              />
            </div>
          )}
        </section>
      </div>

      <Modal
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="فیلترها"
        size="md"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => {
                setDraft({ ...EMPTY_FILTERS, search: filters.search, sort: filters.sort });
                setDrawerKey((k) => k + 1);
              }}>
              پاک‌کردن
            </Button>
            <Button
              type="button"
              onClick={() => {
                navigate({ ...draft, search: filters.search, sort: filters.sort, page: 1 });
                setDrawerOpen(false);
              }}
            >
              اعمال فیلترها
            </Button>
          </>
        }
      >
        {drawerOpen && (
          <FilterPanel
            key={drawerKey}
            idPrefix="drawer"
            value={draft}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            categories={categories}
            options={options}
            immediate={false}
          />
        )}
      </Modal>
    </main>
  );
}
