import express, { type Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../src/middlewares/errorHandler";
import { createProductsController } from "../../src/modules/products/products.controller";
import { createProductsRouter } from "../../src/modules/products/products.routes";
import { createProductsService } from "../../src/modules/products/products.service";
import { signAccessToken } from "../../src/utils/tokens";
import { DEFAULT_CATEGORY, createFakeSellerProductsRepository } from "../helpers/fakeSellerProductsRepository";

vi.hoisted(() => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
  process.env.JWT_ACCESS_SECRET ??= "test-access-secret-test-access-secret-1234";
  process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-test-refresh-secret-123";
  process.env.CORS_ORIGIN ??= "http://localhost:3000";
});

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const CUSTOMER = "33333333-3333-4333-8333-333333333333";
const PENDING_USER = "44444444-4444-4444-8444-444444444444";
const SUSPENDED_USER = "55555555-5555-4555-8555-555555555555";
const INACTIVE_CATEGORY = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const UNKNOWN_CATEGORY = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MISSING_ID = "00000000-0000-4000-8000-999999999999";

let app: Express;
let fake: ReturnType<typeof createFakeSellerProductsRepository>;
let sellerA: string;
let sellerB: string;

const auth = (userId: string, role: "CUSTOMER" | "SELLER" | "ADMIN" = "SELLER") =>
  `Bearer ${signAccessToken({ userId, role })}`;

const validBody = (overrides: Record<string, unknown> = {}) => ({
  categoryId: DEFAULT_CATEGORY,
  title: "کت پشمی مردانه",
  description: "کت پشمی با آستر نرم و دوخت مرغوب",
  basePrice: 2_500_000,
  variants: [{ size: "M", color: "مشکی", stock: 4 }],
  ...overrides,
});

beforeEach(() => {
  fake = createFakeSellerProductsRepository();
  sellerA = fake.addSeller(USER_A, "APPROVED");
  sellerB = fake.addSeller(USER_B, "APPROVED");
  fake.addSeller(PENDING_USER, "PENDING");
  fake.addSeller(SUSPENDED_USER, "SUSPENDED");
  fake.addCategory(DEFAULT_CATEGORY);
  fake.addCategory(INACTIVE_CATEGORY, false);

  app = express();
  app.use(express.json());
  app.use(
    "/api/seller/products",
    createProductsRouter(createProductsController(createProductsService(fake.repository))),
  );
  app.use(errorHandler);
});

describe("دسترسی", () => {
  it("1) بدون احراز هویت → 401", async () => {
    const res = await request(app).get("/api/seller/products");
    expect(res.status).toBe(401);
  });

  it("2) مشتری (بدون حساب فروشندگی) → 403", async () => {
    const res = await request(app).get("/api/seller/products").set("Authorization", auth(CUSTOMER, "CUSTOMER"));
    expect(res.status).toBe(403);
    expect(res.body).not.toHaveProperty("data");
  });

  it("3) فروشنده PENDING → 403 در همه عملیات", async () => {
    const headers = { Authorization: auth(PENDING_USER) };
    expect((await request(app).get("/api/seller/products").set(headers)).status).toBe(403);
    expect((await request(app).post("/api/seller/products").set(headers).send(validBody())).status).toBe(403);
    expect(fake.products).toHaveLength(0);
  });

  it("3b) فروشنده SUSPENDED → 403", async () => {
    const res = await request(app).get("/api/seller/products").set("Authorization", auth(SUSPENDED_USER));
    expect(res.status).toBe(403);
  });

  it("4) فروشنده APPROVED مجاز است؛ حتی با توکن کهنه (نقش CUSTOMER)", async () => {
    const res = await request(app).get("/api/seller/products").set("Authorization", auth(USER_A, "CUSTOMER"));
    expect(res.status).toBe(200);
    expect(res.body.data.data).toEqual([]);
  });
});

describe("ساخت محصول", () => {
  it("5) محصول معتبر ساخته می‌شود: DRAFT، متعلق به فروشنده توکن، slug خودکار", async () => {
    const res = await request(app).post("/api/seller/products").set("Authorization", auth(USER_A)).send(validBody());
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("DRAFT");
    expect(res.body.data.slug).toMatch(/^product-[a-f0-9]{6}$/);
    expect(res.body.data).not.toHaveProperty("sellerId");
    expect(fake.products[0]?.sellerId).toBe(sellerA);
  });

  it("5b) sellerId/status/role ارسالی از کلاینت نادیده گرفته می‌شود", async () => {
    const res = await request(app)
      .post("/api/seller/products")
      .set("Authorization", auth(USER_A))
      .send(validBody({ sellerId: sellerB, status: "PUBLISHED", role: "ADMIN" }));
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("DRAFT");
    expect(fake.products[0]?.sellerId).toBe(sellerA);
  });

  it("5c) slug سفارشی ثبت می‌شود (و به حروف کوچک تبدیل می‌شود)", async () => {
    const res = await request(app)
      .post("/api/seller/products")
      .set("Authorization", auth(USER_A))
      .send(validBody({ slug: "Wool-Coat" }));
    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe("wool-coat");
  });

  it("5d) تصاویر به ترتیب ذخیره می‌شوند", async () => {
    const res = await request(app)
      .post("/api/seller/products")
      .set("Authorization", auth(USER_A))
      .send(validBody({ images: [{ url: "https://cdn.example.com/1.jpg" }, { url: "https://cdn.example.com/2.jpg", altText: "نمای پشت" }] }));
    expect(res.status).toBe(201);
    expect(res.body.data.images.map((i: { position: number }) => i.position)).toEqual([0, 1]);
    expect(res.body.data.images[1].altText).toBe("نمای پشت");
  });

  it.each([
    ["عنوان خالی", { title: "" }],
    ["قیمت منفی", { basePrice: -5 }],
    ["قیمت تخفیفی کمتر از قیمت", { compareAtPrice: 1_000 }],
    ["slug نامعتبر", { slug: "Bad Slug!" }],
    ["تصویر javascript:", { images: [{ url: "javascript:alert(1)" }] }],
    ["بیش از ۸ تصویر", { images: Array.from({ length: 9 }, (_, i) => ({ url: `https://x.com/${i}.jpg` })) }],
    ["بدون تنوع", { variants: [] }],
  ])("6) محصول نامعتبر (%s) → 400", async (_label, overrides) => {
    const res = await request(app).post("/api/seller/products").set("Authorization", auth(USER_A)).send(validBody(overrides));
    expect(res.status).toBe(400);
    expect(fake.products).toHaveLength(0);
  });

  it("7) دسته‌بندی ناموجود یا غیرفعال → 400 با خطای فیلد categoryId", async () => {
    for (const categoryId of [UNKNOWN_CATEGORY, INACTIVE_CATEGORY]) {
      const res = await request(app).post("/api/seller/products").set("Authorization", auth(USER_A)).send(validBody({ categoryId }));
      expect(res.status).toBe(400);
      expect(res.body.error.details.categoryId).toBeDefined();
    }
  });

  it("8) slug تکراری → 409 با خطای فیلد slug (حتی از فروشنده دیگر)", async () => {
    await request(app).post("/api/seller/products").set("Authorization", auth(USER_B)).send(validBody({ slug: "wool-coat" }));
    const res = await request(app).post("/api/seller/products").set("Authorization", auth(USER_A)).send(validBody({ slug: "wool-coat" }));
    expect(res.status).toBe(409);
    expect(res.body.error.details.slug).toBeDefined();
    expect(fake.products).toHaveLength(1);
  });
});

describe("فهرست و مشاهده", () => {
  it("9) فقط محصولات خود فروشنده، با صفحه‌بندی و فیلتر", async () => {
    await fake.seedProduct(sellerA, { title: "کت الف" });
    await fake.seedProduct(sellerA, { title: "شلوار الف", status: "PUBLISHED" });
    await fake.seedProduct(sellerB, { title: "پیراهن ب" });

    const all = await request(app).get("/api/seller/products").set("Authorization", auth(USER_A));
    expect(all.body.data.pagination.total).toBe(2);
    expect(JSON.stringify(all.body)).not.toContain("پیراهن ب");

    const published = await request(app).get("/api/seller/products?status=PUBLISHED").set("Authorization", auth(USER_A));
    expect(published.body.data.data.map((p: { title: string }) => p.title)).toEqual(["شلوار الف"]);

    const search = await request(app).get("/api/seller/products?q=کت").set("Authorization", auth(USER_A));
    expect(search.body.data.data).toHaveLength(1);

    const paged = await request(app).get("/api/seller/products?limit=1&page=2").set("Authorization", auth(USER_A));
    expect(paged.body.data.data).toHaveLength(1);
    expect(paged.body.data.pagination.totalPages).toBe(2);
  });

  it("10) محصول فروشنده دیگر → 404 (وجودش فاش نمی‌شود)", async () => {
    const id = await fake.seedProduct(sellerB, { title: "پیراهن ب" });
    const foreign = await request(app).get(`/api/seller/products/${id}`).set("Authorization", auth(USER_A));
    const missing = await request(app).get(`/api/seller/products/${MISSING_ID}`).set("Authorization", auth(USER_A));
    expect(foreign.status).toBe(404);
    expect(foreign.body.error.message).toBe(missing.body.error.message);
  });

  it("مالک می‌تواند محصول خودش را ببیند", async () => {
    const id = await fake.seedProduct(sellerA);
    const res = await request(app).get(`/api/seller/products/${id}`).set("Authorization", auth(USER_A));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
  });
});

describe("ویرایش", () => {
  it("ویرایش محصول خود: عنوان، قیمت، تصاویر، slug", async () => {
    const id = await fake.seedProduct(sellerA);
    const res = await request(app)
      .patch(`/api/seller/products/${id}`)
      .set("Authorization", auth(USER_A))
      .send({ title: "کت جدید", basePrice: 3_000_000, slug: "new-coat", images: [{ url: "https://cdn.example.com/a.jpg" }] });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ title: "کت جدید", basePrice: 3_000_000, slug: "new-coat" });
    expect(res.body.data.images).toHaveLength(1);
  });

  it("11) ویرایش محصول فروشنده دیگر → 404 و بدون تغییر", async () => {
    const id = await fake.seedProduct(sellerB, { title: "پیراهن ب" });
    const res = await request(app).patch(`/api/seller/products/${id}`).set("Authorization", auth(USER_A)).send({ title: "هک شد" });
    expect(res.status).toBe(404);
    expect(fake.products[0]?.title).toBe("پیراهن ب");
  });

  it("ویرایش با slug تکراری → 409", async () => {
    await fake.seedProduct(sellerB, { slug: "taken-slug" });
    const id = await fake.seedProduct(sellerA);
    const res = await request(app).patch(`/api/seller/products/${id}`).set("Authorization", auth(USER_A)).send({ slug: "taken-slug" });
    expect(res.status).toBe(409);
    expect(res.body.error.details.slug).toBeDefined();
  });

  it("نگه‌داشتن slug فعلی خطای تکراری نمی‌دهد", async () => {
    const id = await fake.seedProduct(sellerA, { slug: "my-coat" });
    const res = await request(app).patch(`/api/seller/products/${id}`).set("Authorization", auth(USER_A)).send({ slug: "my-coat", title: "عنوان تازه" });
    expect(res.status).toBe(200);
  });

  it("تغییر slug محصول منتشرشده → 409", async () => {
    const id = await fake.seedProduct(sellerA, { slug: "live-coat", status: "PUBLISHED" });
    const res = await request(app).patch(`/api/seller/products/${id}`).set("Authorization", auth(USER_A)).send({ slug: "other-slug" });
    expect(res.status).toBe(409);
  });

  it("ویرایش محصول آرشیوشده → 409", async () => {
    const id = await fake.seedProduct(sellerA, { status: "ARCHIVED" });
    const res = await request(app).patch(`/api/seller/products/${id}`).set("Authorization", auth(USER_A)).send({ title: "عنوان تازه" });
    expect(res.status).toBe(409);
  });

  it("دسته‌بندی نامعتبر در ویرایش → 400؛ قیمت تخفیفی ناسازگار → 400", async () => {
    const id = await fake.seedProduct(sellerA);
    const badCat = await request(app).patch(`/api/seller/products/${id}`).set("Authorization", auth(USER_A)).send({ categoryId: INACTIVE_CATEGORY });
    expect(badCat.status).toBe(400);
    const badPrice = await request(app).patch(`/api/seller/products/${id}`).set("Authorization", auth(USER_A)).send({ compareAtPrice: 500 });
    expect(badPrice.status).toBe(400);
  });
});

describe("انتشار و آرشیو", () => {
  it("12) آرشیو محصول فروشنده دیگر (DELETE و PATCH status) → 404 و بدون تغییر", async () => {
    const id = await fake.seedProduct(sellerB);
    const del = await request(app).delete(`/api/seller/products/${id}`).set("Authorization", auth(USER_A));
    const patch = await request(app).patch(`/api/seller/products/${id}/status`).set("Authorization", auth(USER_A)).send({ status: "ARCHIVED" });
    expect(del.status).toBe(404);
    expect(patch.status).toBe(404);
    expect(fake.products[0]?.status).toBe("DRAFT");
  });

  it("انتشار محصول فروشنده دیگر → 404", async () => {
    const id = await fake.seedProduct(sellerB);
    const res = await request(app).patch(`/api/seller/products/${id}/status`).set("Authorization", auth(USER_A)).send({ status: "PUBLISHED" });
    expect(res.status).toBe(404);
    expect(fake.products[0]?.status).toBe("DRAFT");
  });

  it("13) انتشار محصول ناقص (بدون تنوع / دسته غیرفعال) → 409 با فهرست دلایل", async () => {
    const noVariants = await fake.seedProduct(sellerA, { variants: 0 });
    const res = await request(app).patch(`/api/seller/products/${noVariants}/status`).set("Authorization", auth(USER_A)).send({ status: "PUBLISHED" });
    expect(res.status).toBe(409);
    expect(res.body.error.details.status.join(" ")).toContain("تنوع");

    fake.addCategory(INACTIVE_CATEGORY, false);
    const inactive = await fake.seedProduct(sellerA, { categoryId: INACTIVE_CATEGORY });
    const res2 = await request(app).patch(`/api/seller/products/${inactive}/status`).set("Authorization", auth(USER_A)).send({ status: "PUBLISHED" });
    expect(res2.status).toBe(409);
    expect(res2.body.error.details.status.join(" ")).toContain("دسته‌بندی");
    expect(fake.products.every((p) => p.status === "DRAFT")).toBe(true);
  });

  it("14) انتشار موفق محصول کامل", async () => {
    const id = await fake.seedProduct(sellerA);
    const res = await request(app).patch(`/api/seller/products/${id}/status`).set("Authorization", auth(USER_A)).send({ status: "PUBLISHED" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("PUBLISHED");
  });

  it("15) لغو انتشار موفق (PUBLISHED → DRAFT)", async () => {
    const id = await fake.seedProduct(sellerA, { status: "PUBLISHED" });
    const res = await request(app).patch(`/api/seller/products/${id}/status`).set("Authorization", auth(USER_A)).send({ status: "DRAFT" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("DRAFT");
  });

  it("آرشیو با DELETE: محصول حذف فیزیکی نمی‌شود و بازگشت از آرشیو ممکن نیست", async () => {
    const id = await fake.seedProduct(sellerA);
    const del = await request(app).delete(`/api/seller/products/${id}`).set("Authorization", auth(USER_A));
    expect(del.status).toBe(200);
    expect(del.body.data.status).toBe("ARCHIVED");
    expect(fake.products).toHaveLength(1);

    const revive = await request(app).patch(`/api/seller/products/${id}/status`).set("Authorization", auth(USER_A)).send({ status: "DRAFT" });
    expect(revive.status).toBe(409);
  });

  it("وضعیت نامعتبر → 400", async () => {
    const id = await fake.seedProduct(sellerA);
    const res = await request(app).patch(`/api/seller/products/${id}/status`).set("Authorization", auth(USER_A)).send({ status: "DELETED" });
    expect(res.status).toBe(400);
  });
});
