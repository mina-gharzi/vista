// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CatalogFilterOptions, ProductCardSummary } from "@vista/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductDiscoveryView, SEARCH_DEBOUNCE_MS } from "@/features/discovery/ProductDiscoveryView";
import type { ProductPage } from "@/features/discovery/useProductSearch";
import { catalogApi } from "@/lib/api/catalog";
import { categoriesApi } from "@/lib/api/categories";
import { ApiRequestError } from "@/lib/api/client";
import { parseDiscoveryParams, toApiQuery, toSearchParams } from "@/lib/utils/discoveryState";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL ??= "http://localhost:4000/api";
});

// ───── مسیریاب ساختگی با تاریخچهٔ واقعی (push/replace/back) ─────
const nav = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let stack: string[] = [""];
  let index = 0;
  const emit = () => listeners.forEach((l) => l());
  const toSearch = (url: string) => (url.includes("?") ? url.slice(url.indexOf("?") + 1) : "");
  return {
    get: () => stack[index] ?? "",
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    push: (url: string) => {
      stack = [...stack.slice(0, index + 1), toSearch(url)];
      index += 1;
      emit();
    },
    replace: (url: string) => {
      stack[index] = toSearch(url);
      emit();
    },
    back: () => {
      index = Math.max(0, index - 1);
      emit();
    },
    reset: (search = "") => {
      stack = [search];
      index = 0;
    },
    length: () => stack.length,
  };
});

vi.mock("next/navigation", async () => {
  const React = await import("react");
  const router = { push: nav.push, replace: nav.replace };
  return {
    useRouter: () => router,
    usePathname: () => "/products",
    useSearchParams: () => {
      const search = React.useSyncExternalStore(nav.subscribe, nav.get, nav.get);
      return React.useMemo(() => new URLSearchParams(search), [search]);
    },
  };
});
vi.mock("@/lib/api/catalog", () => ({ catalogApi: { list: vi.fn(), filterOptions: vi.fn() } }));
vi.mock("@/lib/api/categories", () => ({ categoriesApi: { getTree: vi.fn() } }));

const list = vi.mocked(catalogApi.list);
const filterOptions = vi.mocked(catalogApi.filterOptions);
const getTree = vi.mocked(categoriesApi.getTree);

const product = (id: string, over: Partial<ProductCardSummary> = {}): ProductCardSummary => ({
  id, slug: `p-${id}`, title: `محصول ${id}`, imageUrl: null, basePrice: 1_000_000, compareAtPrice: null,
  categoryName: "کت", sellerStoreName: "بوتیک آرا", sellerStoreSlug: "ara", inStock: true, ...over,
});
const page = (items: ProductCardSummary[], over: Partial<ProductPage["pagination"]> = {}): ProductPage => ({
  data: items,
  pagination: { page: 1, limit: 24, total: items.length, totalPages: 1, ...over },
});
const OPTIONS: CatalogFilterOptions = { colors: ["مشکی", "کرم"], sizes: ["S", "M"], priceRange: { min: 100_000, max: 5_000_000 } };

const lastQuery = () => list.mock.calls.at(-1)![0]!;
const renderView = (initial: Parameters<typeof ProductDiscoveryView>[0]["initial"] = null) => render(<ProductDiscoveryView initial={initial} />);

beforeEach(() => {
  vi.clearAllMocks();
  nav.reset("");
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
  list.mockResolvedValue(page([product("1"), product("2")], { totalPages: 3, total: 50 }));
  filterOptions.mockResolvedValue(OPTIONS);
  getTree.mockResolvedValue([{ id: "c1", name: "پوشاک", slug: "clothes", imageUrl: null, children: [{ id: "c2", name: "کت", slug: "coats", imageUrl: null, children: [] }] }]);
});
afterEach(cleanup);

describe("وضعیت‌ها", () => {
  it("اسکلت بارگذاری، سپس محصولات و تعداد نتایج", async () => {
    let resolve!: (p: ProductPage) => void;
    list.mockReturnValue(new Promise((r) => (resolve = r)));
    renderView();
    expect(screen.getByLabelText("در حال بارگذاری محصولات")).toHaveAttribute("aria-busy", "true");
    resolve(page([product("1")], { total: 1 }));
    expect(await screen.findByText("محصول 1")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("۱ محصول");
  });

  it("خطای شبکه ≠ نتیجهٔ خالی: پیام خطا + تلاش مجدد", async () => {
    list.mockRejectedValueOnce(new ApiRequestError(0, "NETWORK_ERROR", "قطع")).mockResolvedValue(page([product("9")]));
    renderView();
    expect(await screen.findByText("دریافت محصولات انجام نشد")).toBeInTheDocument();
    expect(screen.queryByText("محصولی پیدا نشد")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "تلاش مجدد" }));
    expect(await screen.findByText("محصول 9")).toBeInTheDocument();
  });

  it("نتیجهٔ خالی با فیلتر: پیام مناسب و دکمهٔ پاک‌کردن", async () => {
    nav.reset("search=xyz&inStock=true");
    list.mockResolvedValue(page([], { total: 0 }));
    renderView();
    expect(await screen.findByText("محصولی پیدا نشد")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "پاک‌کردن جستجو و فیلترها" }));
    await waitFor(() => expect(nav.get()).toBe(""));
  });

  it("نتیجهٔ SSR برای همان URL درخواست اول را حذف می‌کند", async () => {
    nav.reset("sort=price_asc");
    const key = toSearchParams(parseDiscoveryParams(new URLSearchParams("sort=price_asc"))).toString();
    renderView({ key, result: page([product("ssr")]) });
    expect(screen.getByText("محصول ssr")).toBeInTheDocument();
    await waitFor(() => expect(filterOptions).toHaveBeenCalled());
    expect(list).not.toHaveBeenCalled();
  });
});

describe("جستجو", () => {
  it("Debounce: چند حرف پشت‌سرهم یک درخواست می‌سازند و تاریخچه را پر نمی‌کند", async () => {
    renderView();
    await screen.findByText("محصول 1");
    const callsBefore = list.mock.calls.length;
    const historyBefore = nav.length();
    await userEvent.type(screen.getByLabelText("جستجو", { selector: "input" }), "کتان");
    await waitFor(() => expect(lastQuery().search).toBe("کتان"), { timeout: SEARCH_DEBOUNCE_MS + 1500 });
    const searches = list.mock.calls.slice(callsBefore).map((c) => c[0]!.search);
    expect(searches).toEqual(["کتان"]);
    expect(nav.length()).toBe(historyBefore); // replace، نه push
    expect(nav.get()).toContain("search=");
  });

  it("پاسخ کهنه نتیجهٔ جدیدتر را بازنویسی نمی‌کند", async () => {
    const resolvers: ((p: ProductPage) => void)[] = [];
    list.mockImplementation(() => new Promise((r) => resolvers.push(r)));
    renderView();
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    await userEvent.selectOptions(screen.getByLabelText("مرتب‌سازی"), "price_asc");
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    // اول پاسخ جدید، بعد پاسخ کهنه
    await act(async () => resolvers[1]!(page([product("new")])));
    expect(await screen.findByText("محصول new")).toBeInTheDocument();
    await act(async () => resolvers[0]!(page([product("old")])));
    expect(screen.queryByText("محصول old")).not.toBeInTheDocument();
    expect(screen.getByText("محصول new")).toBeInTheDocument();
  });

  it("درخواست قبلی با AbortSignal لغو می‌شود", async () => {
    const signals: AbortSignal[] = [];
    list.mockImplementation((_q, o) => {
      signals.push(o!.signal!);
      return new Promise(() => undefined);
    });
    renderView();
    await waitFor(() => expect(signals).toHaveLength(1));
    await userEvent.selectOptions(screen.getByLabelText("مرتب‌سازی"), "price_desc");
    await waitFor(() => expect(signals).toHaveLength(2));
    expect(signals[0]!.aborted).toBe(true);
    expect(signals[1]!.aborted).toBe(false);
  });

  it("ارسال فرم (Enter) فوراً و با push جستجو می‌کند و صفحه را به ۱ برمی‌گرداند", async () => {
    nav.reset("page=3");
    renderView();
    await screen.findByText("محصول 1");
    await userEvent.type(screen.getByLabelText("جستجو", { selector: "input" }), "پالتو{Enter}");
    await waitFor(() => expect(lastQuery()).toMatchObject({ search: "پالتو", page: 1 }));
  });
});

describe("URL: بازیابی، پاک‌سازی و ناوبری", () => {
  it("حالت UI از URL بازیابی می‌شود", async () => {
    nav.reset("search=" + encodeURIComponent("کت") + "&minPrice=100000&maxPrice=900000&sort=price_asc&inStock=true&color=" + encodeURIComponent("مشکی"));
    renderView();
    await screen.findByText("محصول 1");
    expect(lastQuery()).toMatchObject({ search: "کت", minPrice: 100000, maxPrice: 900000, sort: "price_asc", inStock: true, color: "مشکی" });
    expect(screen.getByLabelText("جستجو", { selector: "input" })).toHaveValue("کت");
    expect(screen.getByLabelText("مرتب‌سازی")).toHaveValue("price_asc");
    expect(screen.getByRole("button", { name: /حذف فیلتر رنگ: مشکی/ })).toBeInTheDocument();
    expect(screen.getAllByLabelText("فقط کالاهای موجود")[0]).toBeChecked();
  });

  it("پارامترهای نامعتبر/ناسازگار بی‌صدا به مقدار امن برمی‌گردند", async () => {
    nav.reset("sort=evil&page=-3&minPrice=abc&category=Bad%20Slug&maxPrice=5&minPrice=9");
    renderView();
    await screen.findByText("محصول 1");
    const q = lastQuery();
    expect(q).toMatchObject({ page: 1, sort: "newest" });
    expect(q.category).toBeUndefined();
    expect(q.minPrice).toBeUndefined();
  });

  it("بازهٔ قیمت معکوس در URL: حداکثر حذف می‌شود", () => {
    const f = parseDiscoveryParams(new URLSearchParams("minPrice=500&maxPrice=100"));
    expect(f).toMatchObject({ minPrice: 500, maxPrice: null });
  });

  it("sort=discounted قدیمی به فیلتر تخفیف نگاشت می‌شود و round-trip پایدار است", () => {
    const f = parseDiscoveryParams(new URLSearchParams("sort=discounted"));
    expect(f).toMatchObject({ discounted: true, sort: "newest" });
    const qs = toSearchParams(f).toString();
    expect(qs).toBe("discounted=true");
    expect(parseDiscoveryParams(new URLSearchParams(qs))).toEqual(f);
    expect(toApiQuery(f)).toMatchObject({ discounted: true, sort: "newest", limit: 24 });
  });

  it("Back/Forward: ورودی جستجو و نتایج به حالت قبل برمی‌گردند", async () => {
    renderView();
    await screen.findByText("محصول 1");
    await userEvent.type(screen.getByLabelText("جستجو", { selector: "input" }), "شال{Enter}");
    await waitFor(() => expect(lastQuery().search).toBe("شال"));
    act(() => nav.back());
    await waitFor(() => expect(screen.getByLabelText("جستجو", { selector: "input" })).toHaveValue(""));
    await waitFor(() => expect(lastQuery().search).toBeUndefined());
  });
});

describe("فیلترها، مرتب‌سازی و صفحه‌بندی", () => {
  it("تغییر فیلتر صفحه را به ۱ برمی‌گرداند و بقیهٔ فیلترها حفظ می‌شوند", async () => {
    nav.reset("page=3&sort=price_desc&search=" + encodeURIComponent("کت"));
    renderView();
    await screen.findByText("محصول 1");
    await userEvent.click(screen.getAllByLabelText("فقط کالاهای موجود")[0]!);
    await waitFor(() => expect(lastQuery()).toMatchObject({ inStock: true, page: 1, sort: "price_desc", search: "کت" }));
  });

  it("رنگ و سایز از گزینه‌های سرور ساخته می‌شوند و toggle می‌شوند", async () => {
    renderView();
    await screen.findByText("محصول 1");
    await userEvent.click(await screen.findByRole("button", { name: "رنگ مشکی" }));
    await waitFor(() => expect(lastQuery().color).toBe("مشکی"));
    await userEvent.click(screen.getByRole("button", { name: "سایز M" }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ color: "مشکی", size: "M" }));
    await userEvent.click(screen.getByRole("button", { name: "رنگ مشکی" }));
    await waitFor(() => expect(lastQuery().color).toBeUndefined());
  });

  it("بازهٔ قیمت: نامعتبر/معکوس خطا می‌دهد و ارسال نمی‌شود؛ معتبر اعمال می‌شود (ارقام فارسی هم)", async () => {
    renderView();
    await screen.findByText("محصول 1");
    const callsBefore = list.mock.calls.length;
    const side = screen.getByRole("complementary", { name: "فیلترها" });
    await userEvent.type(within(side).getByLabelText("از"), "900");
    await userEvent.type(within(side).getByLabelText("تا"), "100");
    await userEvent.click(within(side).getByRole("button", { name: "اعمال قیمت" }));
    expect(await within(side).findByRole("alert")).toHaveTextContent("حداقل قیمت");
    expect(list.mock.calls.length).toBe(callsBefore);
    await userEvent.clear(within(side).getByLabelText("تا"));
    await userEvent.type(within(side).getByLabelText("تا"), "۲۰۰۰");
    await userEvent.click(within(side).getByRole("button", { name: "اعمال قیمت" }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ minPrice: 900, maxPrice: 2000 }));
  });

  it("چیپ‌های فیلتر فعال تک‌تک و یکجا حذف می‌شوند", async () => {
    nav.reset("inStock=true&discounted=true&size=M");
    renderView();
    await screen.findByText("محصول 1");
    await userEvent.click(screen.getByRole("button", { name: "حذف فیلتر فقط موجود" }));
    await waitFor(() => expect(lastQuery().inStock).toBeUndefined());
    expect(lastQuery()).toMatchObject({ discounted: true, size: "M" });
    await userEvent.click(screen.getByRole("button", { name: "پاک‌کردن همه" }));
    await waitFor(() => expect(nav.get()).toBe(""));
  });

  it("صفحه‌بندی فیلترها و مرتب‌سازی را حفظ می‌کند", async () => {
    nav.reset("sort=price_asc&inStock=true");
    renderView();
    await screen.findByText("محصول 1");
    await userEvent.click(screen.getByRole("button", { name: "صفحه ۲" }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ page: 2, sort: "price_asc", inStock: true }));
  });
});

describe("منوی فیلتر موبایل", () => {
  it("تغییرات تا «اعمال» فقط پیش‌نویس‌اند؛ پاک‌کردن پیش‌نویس را ریست می‌کند", async () => {
    renderView();
    await screen.findByText("محصول 1");
    await userEvent.click(screen.getByRole("button", { name: /^فیلترها/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByLabelText("فقط کالاهای تخفیف‌دار"));
    expect(nav.get()).toBe(""); // هنوز اعمال نشده
    await userEvent.click(within(dialog).getByRole("button", { name: "پاک‌کردن" }));
    expect(within(dialog).getByLabelText("فقط کالاهای تخفیف‌دار")).not.toBeChecked();
    await userEvent.click(within(dialog).getByLabelText("فقط کالاهای موجود"));
    await userEvent.click(within(dialog).getByRole("button", { name: "اعمال فیلترها" }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ inStock: true, page: 1 }));
    expect(lastQuery().discounted).toBeUndefined();
    expect(nav.get()).toContain("inStock=true");
  });

  it("شمارندهٔ فیلتر فعال روی دکمه نمایش داده می‌شود", async () => {
    nav.reset("inStock=true&size=M");
    renderView();
    expect(await screen.findByRole("button", { name: "فیلترها (۲)" })).toBeInTheDocument();
  });
});

describe("کارت محصول", () => {
  it("فروشگاه و نشان ناموجود", () => {
    render(<ProductCard product={product("x", { inStock: false })} />);
    expect(screen.getByText(/بوتیک آرا/)).toBeInTheDocument();
    expect(screen.getByText("ناموجود")).toBeInTheDocument();
    cleanup();
    render(<ProductCard product={product("y")} />);
    expect(screen.queryByText("ناموجود")).not.toBeInTheDocument();
  });
});
