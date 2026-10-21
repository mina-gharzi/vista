import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { normalizeSearchText, searchTokens, legacyArabicVariant, type CatalogQuery } from "@vista/shared";
import { errorHandler } from "../../src/middlewares/errorHandler";
import { createCatalogController } from "../../src/modules/catalog/catalog.controller";
import { toProductCard } from "../../src/modules/catalog/catalog.mapper";
import { buildCatalogWhere, buildOrderBy, sortSizes } from "../../src/modules/catalog/catalog.query";
import type { CatalogRepository, ProductCardRow } from "../../src/modules/catalog/catalog.repository";
import { createCatalogRouter } from "../../src/modules/catalog/catalog.routes";
import { createCatalogService } from "../../src/modules/catalog/catalog.service";

const row = (over: Partial<ProductCardRow> = {}): ProductCardRow => ({
  id: "p1", slug: "coat", title: "کت", basePrice: 1000, compareAtPrice: null,
  category: { name: "کت" }, images: [], seller: { storeName: "آرا", storeSlug: "ara" }, variants: [{ id: "v1" }], ...over,
});

function build(overrides: Partial<CatalogRepository> = {}) {
  const calls: { query: CatalogQuery; categoryIds: string[] | undefined }[] = [];
  const optionCalls: unknown[] = [];
  const repo: CatalogRepository = {
    resolveCategorySubtreeIds: async (slug) => (slug === "missing" ? null : [`id-${slug}`, `child-${slug}`]),
    findMany: async (query, categoryIds) => {
      calls.push({ query, categoryIds });
      return { items: [row()], total: 100 };
    },
    findPublishedBySlug: async () => null,
    filterOptions: async (q, ids) => {
      optionCalls.push({ q, ids });
      return { colors: ["مشکی"], sizes: ["XL", "M", "42", "S", "40"], priceRange: { min: 10, max: 99 } };
    },
    ...overrides,
  };
  const app = express();
  app.use("/api/products", createCatalogRouter(createCatalogController(createCatalogService(repo))));
  app.use(errorHandler);
  return { app, calls, optionCalls };
}

describe("نرمال‌سازی متن جستجو", () => {
  it("ی/ک عربی، ارقام، اعراب، کشیده و نیم‌فاصله را یکسان می‌کند", () => {
    expect(normalizeSearchText("كتِ  پشمي")).toBe("کت پشمی");
    expect(normalizeSearchText("مدل ۱۲۳ و ٤٥٦")).toBe("مدل 123 و 456");
    expect(normalizeSearchText("کت‌شلوار")).toBe("کت شلوار");
    expect(normalizeSearchText("کـــت")).toBe("کت");
    expect(normalizeSearchText("  Coat   ABC ")).toBe("coat abc");
  });
  it("نویسه‌های wildcard و کنترلی حذف می‌شوند", () => {
    expect(normalizeSearchText("100%_off\\x\u0000y")).toBe("100 off x y");
  });
  it("کلمه‌ها یکتا و کراندارند؛ شکل عربی برای دادهٔ قدیمی ساخته می‌شود", () => {
    expect(searchTokens("a a b c d e f g")).toEqual(["a", "b", "c", "d", "e"]);
    expect(searchTokens("x".repeat(200))[0]).toHaveLength(40);
    expect(legacyArabicVariant("کی")).toBe("كي");
  });
});

describe("اعتبارسنجی Query (GET /api/products)", () => {
  const get = (qs: string, ctx = build()) => request(ctx.app).get(`/api/products${qs}`);

  it("پیش‌فرض‌ها: صفحه ۱، limit ۲۴، newest و بدون جستجو", async () => {
    const ctx = build();
    const res = await get("", ctx);
    expect(res.status).toBe(200);
    expect(ctx.calls[0]!.query).toMatchObject({ page: 1, limit: 24, sort: "newest" });
    expect(ctx.calls[0]!.query.search).toBeUndefined();
  });

  it("جستجوی خالی/فقط‌فاصله خطا نیست و نادیده گرفته می‌شود", async () => {
    const ctx = build();
    expect((await get("?search=%20%20", ctx)).status).toBe(200);
    expect((await get("?search=", ctx)).status).toBe(200);
    expect(ctx.calls.every((c) => c.query.search === undefined)).toBe(true);
  });

  it("جستجو نرمال‌سازی می‌شود و بیش از ۱۰۰ نویسه ۴۰۰ است", async () => {
    const ctx = build();
    await get(`?search=${encodeURIComponent("كت  پشمي ۲")}`, ctx);
    expect(ctx.calls[0]!.query.search).toBe("کت پشمی 2");
    expect((await get(`?search=${"a".repeat(101)}`)).status).toBe(400);
  });

  it("مقادیر نامعتبر رد می‌شوند: sort، limit، page، قیمت منفی/بزرگ، بازهٔ معکوس", async () => {
    for (const qs of [
      "?sort=price;drop", "?sort=popular", "?limit=49", "?limit=0", "?page=0", "?page=10001",
      "?minPrice=-1", "?maxPrice=2000000001", "?minPrice=abc", "?minPrice=500&maxPrice=100",
      "?inStock=yes", "?color=" + "x".repeat(31), "?seller=Bad%20Slug",
    ]) {
      expect((await get(qs)).status, qs).toBe(400);
    }
  });

  it("فیلترهای معتبر به Repository می‌رسند (بولی‌ها تبدیل می‌شوند)", async () => {
    const ctx = build();
    await get("?minPrice=100&maxPrice=100&seller=ara&color=مشکی&size=M&inStock=true&discounted=true&sort=price_asc&page=2&limit=12", ctx);
    expect(ctx.calls[0]!.query).toMatchObject({
      minPrice: 100, maxPrice: 100, seller: "ara", color: "مشکی", size: "M", inStock: true, discounted: true, sort: "price_asc", page: 2, limit: 12,
    });
  });

  it("دستهٔ ناموجود → فهرست خالی (نه خطا) و Repository صدا زده نمی‌شود", async () => {
    const ctx = build();
    const res = await get("?category=missing", ctx);
    expect(res.status).toBe(200);
    expect(res.body.data.data).toEqual([]);
    expect(ctx.calls).toHaveLength(0);
  });

  it("زیردسته‌ها به Repository داده می‌شوند و متادیتای صفحه‌بندی درست است", async () => {
    const ctx = build();
    const res = await get("?category=coats&limit=24&page=2", ctx);
    expect(ctx.calls[0]!.categoryIds).toEqual(["id-coats", "child-coats"]);
    expect(res.body.data.pagination).toEqual({ page: 2, limit: 24, total: 100, totalPages: 5 });
    expect(res.body.data.data[0]).toMatchObject({ sellerStoreName: "آرا", sellerStoreSlug: "ara", inStock: true });
  });

  it("پاسخ فقط فیلدهای عمومی دارد (بدون id فروشنده/وضعیت)", async () => {
    const res = await get("");
    const item = res.body.data.data[0];
    expect(Object.keys(item).sort()).toEqual(
      ["basePrice", "categoryName", "compareAtPrice", "id", "imageUrl", "inStock", "sellerStoreName", "sellerStoreSlug", "slug", "title"],
    );
  });
});

describe("گزینه‌های فیلتر (GET /api/products/filters/options)", () => {
  it("سایزها به ترتیب استاندارد مرتب می‌شوند و با /:slug تداخل ندارد", async () => {
    const ctx = build();
    const res = await request(ctx.app).get("/api/products/filters/options?category=coats&search=کت");
    expect(res.status).toBe(200);
    expect(res.body.data.sizes).toEqual(["S", "M", "XL", "40", "42"]);
    expect(res.body.data.priceRange).toEqual({ min: 10, max: 99 });
    expect(ctx.optionCalls[0]).toMatchObject({ ids: ["id-coats", "child-coats"], q: { search: "کت" } });
  });
  it("دستهٔ ناموجود → گزینه‌های خالی", async () => {
    const res = await request(build().app).get("/api/products/filters/options?category=missing");
    expect(res.body.data).toEqual({ colors: [], sizes: [], priceRange: null });
  });
  it("sortSizes: حروفی، عددی، سپس الفبایی", () => {
    expect(sortSizes(["XL", "ویژه", "M", "44", "xs", "38"])).toEqual(["xs", "M", "XL", "38", "44", "ویژه"]);
  });
});

describe("ساخت شرط Prisma", () => {
  const base = { sort: "newest" as const };
  const where = (q: Partial<CatalogQuery> = {}, ids?: string[]) => buildCatalogWhere({ ...base, ...q }, ids);

  it("قاعدهٔ دید مشتری همیشه هست (منتشرشده + فروشندهٔ تأییدشده) و با فیلتر فروشگاه ترکیب می‌شود", () => {
    expect(where()).toMatchObject({ status: "PUBLISHED", seller: { status: "APPROVED" } });
    expect(where({ seller: "ara" })).toMatchObject({ status: "PUBLISHED", seller: { status: "APPROVED", storeSlug: "ara" } });
  });

  it("قیمت: min و max هر دو در یک شرط (مرز شامل) — باگ قبلی بازنویسی minPrice", () => {
    expect(where({ minPrice: 100, maxPrice: 200 }).basePrice).toEqual({ gte: 100, lte: 200 });
    expect(where({ minPrice: 100, maxPrice: 100 }).basePrice).toEqual({ gte: 100, lte: 100 });
    expect(where({ minPrice: 0 }).basePrice).toEqual({ gte: 0 });
    expect(where({ maxPrice: 50 }).basePrice).toEqual({ lte: 50 });
    expect(where().basePrice).toBeUndefined();
  });

  it("تخفیف: هم فیلتر discounted و هم sort=discounted فقط compareAtPrice غیرخالی", () => {
    expect(where({ discounted: true }).compareAtPrice).toEqual({ not: null });
    expect(where({ sort: "discounted" }).compareAtPrice).toEqual({ not: null });
    expect(where().compareAtPrice).toBeUndefined();
  });

  it("رنگ/سایز/موجودی روی «یک» تنوع فعال (some) اعمال می‌شود", () => {
    const and = where({ color: "مشکی", size: "M", inStock: true }).AND as unknown[];
    expect(and).toHaveLength(1);
    expect(and[0]).toEqual({
      variants: {
        some: {
          isActive: true,
          color: { equals: "مشکی", mode: "insensitive" },
          size: { equals: "M", mode: "insensitive" },
          stock: { gt: 0 },
        },
      },
    });
    expect(where().AND).toEqual([]);
  });

  it("جستجو: هر کلمه AND، و هر کلمه در عنوان/توضیحات/نام دسته (با شکل عربی)", () => {
    const and = where({ search: "کت پشمی" }).AND as { OR: unknown[] }[];
    expect(and).toHaveLength(2);
    // هر کلمه: ۲ شکل × ۳ فیلد
    expect(and[0]!.OR).toHaveLength(6);
    expect(JSON.stringify(and[0])).toContain("description");
    expect(JSON.stringify(and[0])).toContain('"category":{"name"');
    expect(JSON.stringify(and[0])).toContain("كت");
    // کلمهٔ بدون ی/ک فقط یک شکل دارد
    expect((where({ search: "wool" }).AND as { OR: unknown[] }[])[0]!.OR).toHaveLength(3);
  });

  it("دسته و جستجو و فیلترها با هم ترکیب می‌شوند", () => {
    const w = where({ search: "wool", minPrice: 1, seller: "ara", inStock: true }, ["c1", "c2"]);
    expect(w.categoryId).toEqual({ in: ["c1", "c2"] });
    expect((w.AND as unknown[]).length).toBe(2);
    expect(w.basePrice).toEqual({ gte: 1 });
  });

  it("مرتب‌سازی قطعی با کلید دوم id و فقط از Enum", () => {
    expect(buildOrderBy("newest")).toEqual([{ createdAt: "desc" }, { id: "asc" }]);
    expect(buildOrderBy("discounted")).toEqual([{ createdAt: "desc" }, { id: "asc" }]);
    expect(buildOrderBy("price_asc")).toEqual([{ basePrice: "asc" }, { id: "asc" }]);
    expect(buildOrderBy("price_desc")).toEqual([{ basePrice: "desc" }, { id: "asc" }]);
  });
});

describe("Mapper", () => {
  it("inStock از وجود تنوع فعالِ موجود می‌آید", () => {
    expect(toProductCard(row({ variants: [] })).inStock).toBe(false);
    expect(toProductCard(row()).inStock).toBe(true);
  });
});
