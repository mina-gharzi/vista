import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { bearerFor, buildProductsApp } from "../helpers/buildProductsApp";

vi.mock("../../src/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function validVariant(overrides: Partial<{ size: string; color: string; stock: number }> = {}) {
  return { size: "M", color: "مشکی", stock: 10, ...overrides };
}

function validPayload(categoryId: string, overrides: Record<string, unknown> = {}) {
  return {
    categoryId,
    title: "پیراهن کتان زنانه",
    description: "پیراهن کتان با کیفیت بالا و دوخت درجه یک",
    basePrice: 450_000,
    variants: [validVariant()],
    images: [],
    ...overrides,
  };
}

describe("POST /api/seller/products", () => {
  it("بدون ورود 401 می‌دهد", async () => {
    const { app } = buildProductsApp();
    const res = await request(app).post("/api/seller/products").send({});
    expect(res.status).toBe(401);
  });

  it("نقش CUSTOMER اجازه دسترسی ندارد (403)", async () => {
    const { app } = buildProductsApp();
    const userId = randomUUID();
    const res = await request(app)
      .post("/api/seller/products")
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({});
    expect(res.status).toBe(403);
  });

  it("کاربری که حساب فروشندگی ندارد 403 می‌گیرد", async () => {
    const { app } = buildProductsApp();
    const userId = randomUUID();
    const res = await request(app)
      .post("/api/seller/products")
      .set("Authorization", bearerFor(userId))
      .send(validPayload(randomUUID()));
    expect(res.status).toBe(403);
  });

  it("فروشنده در انتظار تأیید (PENDING) اجازه ساخت محصول ندارد", async () => {
    const { app, repo } = buildProductsApp();
    const userId = randomUUID();
    repo.seedSeller(userId, "PENDING");
    const categoryId = repo.seedActiveCategory();

    const res = await request(app)
      .post("/api/seller/products")
      .set("Authorization", bearerFor(userId))
      .send(validPayload(categoryId));

    expect(res.status).toBe(403);
  });

  it("فروشنده تأییدشده محصول را با موجودی اولیه می‌سازد", async () => {
    const { app, repo } = buildProductsApp();
    const userId = randomUUID();
    repo.seedSeller(userId, "APPROVED");
    const categoryId = repo.seedActiveCategory();

    const res = await request(app)
      .post("/api/seller/products")
      .set("Authorization", bearerFor(userId))
      .send(validPayload(categoryId));

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("DRAFT");
    expect(res.body.data.slug).toMatch(/^[a-z0-9-]+$/);
    expect(res.body.data.variants).toHaveLength(1);
    expect(res.body.data.variants[0].stock).toBe(10);
    expect(res.body.data.variants[0].sku).toMatch(/^VST-/);
  });

  it("دسته‌بندی نامعتبر/غیرفعال 400 می‌دهد", async () => {
    const { app, repo } = buildProductsApp();
    const userId = randomUUID();
    repo.seedSeller(userId, "APPROVED");

    const res = await request(app)
      .post("/api/seller/products")
      .set("Authorization", bearerFor(userId))
      .send(validPayload(randomUUID())); // دسته‌ای که seed نشده = غیرفعال/ناموجود

    expect(res.status).toBe(400);
    expect(res.body.error.details.categoryId).toBeDefined();
  });

  it("قیمت قبل از تخفیف کمتر یا مساوی قیمت فعلی 400 می‌دهد", async () => {
    const { app, repo } = buildProductsApp();
    const userId = randomUUID();
    repo.seedSeller(userId, "APPROVED");
    const categoryId = repo.seedActiveCategory();

    const res = await request(app)
      .post("/api/seller/products")
      .set("Authorization", bearerFor(userId))
      .send(validPayload(categoryId, { compareAtPrice: 400_000 }));

    expect(res.status).toBe(400);
    expect(res.body.error.details.compareAtPrice).toBeDefined();
  });

  it("بدون هیچ Variant، 400 می‌دهد", async () => {
    const { app, repo } = buildProductsApp();
    const userId = randomUUID();
    repo.seedSeller(userId, "APPROVED");
    const categoryId = repo.seedActiveCategory();

    const res = await request(app)
      .post("/api/seller/products")
      .set("Authorization", bearerFor(userId))
      .send(validPayload(categoryId, { variants: [] }));

    expect(res.status).toBe(400);
  });

  it("ترکیب سایز/رنگ تکراری در همان درخواست 400 می‌دهد", async () => {
    const { app, repo } = buildProductsApp();
    const userId = randomUUID();
    repo.seedSeller(userId, "APPROVED");
    const categoryId = repo.seedActiveCategory();

    const res = await request(app)
      .post("/api/seller/products")
      .set("Authorization", bearerFor(userId))
      .send(validPayload(categoryId, { variants: [validVariant(), validVariant({ size: "m" })] }));

    expect(res.status).toBe(400);
    expect(res.body.error.details.variants).toBeDefined();
  });

  it("موجودی منفی 400 می‌دهد", async () => {
    const { app, repo } = buildProductsApp();
    const userId = randomUUID();
    repo.seedSeller(userId, "APPROVED");
    const categoryId = repo.seedActiveCategory();

    const res = await request(app)
      .post("/api/seller/products")
      .set("Authorization", bearerFor(userId))
      .send(validPayload(categoryId, { variants: [validVariant({ stock: -1 })] }));

    expect(res.status).toBe(400);
  });
});

describe("GET /api/seller/products/:id — مالکیت", () => {
  it("فروشنده دیگر با 404 مواجه می‌شود (نه 403) — جلوگیری از IDOR", async () => {
    const { app, repo } = buildProductsApp();
    const ownerUserId = randomUUID();
    const ownerSellerId = repo.seedSeller(ownerUserId, "APPROVED");
    const categoryId = repo.seedActiveCategory();
    const product = repo.seedProduct({ sellerId: ownerSellerId, categoryId });

    const otherUserId = randomUUID();
    repo.seedSeller(otherUserId, "APPROVED");

    const res = await request(app)
      .get(`/api/seller/products/${product.id}`)
      .set("Authorization", bearerFor(otherUserId));

    expect(res.status).toBe(404);
  });

  it("مالک محصول خودش را می‌بیند", async () => {
    const { app, repo } = buildProductsApp();
    const userId = randomUUID();
    const sellerId = repo.seedSeller(userId, "APPROVED");
    const categoryId = repo.seedActiveCategory();
    const product = repo.seedProduct({ sellerId, categoryId, title: "کیف چرم" });

    const res = await request(app)
      .get(`/api/seller/products/${product.id}`)
      .set("Authorization", bearerFor(userId));

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe("کیف چرم");
  });

  it("شناسه با فرمت نامعتبر 400 می‌دهد", async () => {
    const { app, repo } = buildProductsApp();
    const userId = randomUUID();
    repo.seedSeller(userId, "APPROVED");

    const res = await request(app)
      .get("/api/seller/products/not-a-uuid")
      .set("Authorization", bearerFor(userId));

    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/seller/products/:id", () => {
  it("محصول آرشیوشده قابل ویرایش نیست", async () => {
    const { app, repo } = buildProductsApp();
    const userId = randomUUID();
    const sellerId = repo.seedSeller(userId, "APPROVED");
    const categoryId = repo.seedActiveCategory();
    const product = repo.seedProduct({ sellerId, categoryId, status: "ARCHIVED" });

    const res = await request(app)
      .patch(`/api/seller/products/${product.id}`)
      .set("Authorization", bearerFor(userId))
      .send({ title: "عنوان جدید" });

    expect(res.status).toBe(409);
  });

  it("ویرایش basePrice تنها را با compareAtPrice موجود ناسازگار نمی‌کند", async () => {
    const { app, repo } = buildProductsApp();
    const userId = randomUUID();
    const sellerId = repo.seedSeller(userId, "APPROVED");
    const categoryId = repo.seedActiveCategory();
    const product = repo.seedProduct({
      sellerId,
      categoryId,
      basePrice: 100_000,
      compareAtPrice: 150_000,
    });

    // قیمت جدید را بالاتر از compareAtPrice موجود می‌بریم → باید رد شود
    const res = await request(app)
      .patch(`/api/seller/products/${product.id}`)
      .set("Authorization", bearerFor(userId))
      .send({ basePrice: 200_000 });

    expect(res.status).toBe(400);
    expect(res.body.error.details.compareAtPrice).toBeDefined();
  });

  it("ویرایش موفق فیلدهای مجاز", async () => {
    const { app, repo } = buildProductsApp();
    const userId = randomUUID();
    const sellerId = repo.seedSeller(userId, "APPROVED");
    const categoryId = repo.seedActiveCategory();
    const product = repo.seedProduct({ sellerId, categoryId, title: "قدیمی" });

    const res = await request(app)
      .patch(`/api/seller/products/${product.id}`)
      .set("Authorization", bearerFor(userId))
      .send({ title: "عنوان به‌روز‌شده" });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe("عنوان به‌روز‌شده");
  });

  it("بدنه خالی 400 می‌دهد", async () => {
    const { app, repo } = buildProductsApp();
    const userId = randomUUID();
    const sellerId = repo.seedSeller(userId, "APPROVED");
    const categoryId = repo.seedActiveCategory();
    const product = repo.seedProduct({ sellerId, categoryId });

    const res = await request(app)
      .patch(`/api/seller/products/${product.id}`)
      .set("Authorization", bearerFor(userId))
      .send({});

    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/seller/products/:id/status", () => {
  it("انتشار محصول بدون Variant مجاز نیست", async () => {
    const { app, repo } = buildProductsApp();
    const userId = randomUUID();
    const sellerId = repo.seedSeller(userId, "APPROVED");
    const categoryId = repo.seedActiveCategory();
    const product = repo.seedProduct({ sellerId, categoryId, variants: [] });

    const res = await request(app)
      .patch(`/api/seller/products/${product.id}/status`)
      .set("Authorization", bearerFor(userId))
      .send({ status: "PUBLISHED" });

    expect(res.status).toBe(409);
  });

  it("انتشار محصول با Variant موفق است", async () => {
    const { app, repo } = buildProductsApp();
    const userId = randomUUID();
    const sellerId = repo.seedSeller(userId, "APPROVED");
    const categoryId = repo.seedActiveCategory();
    const product = repo.seedProduct({
      sellerId,
      categoryId,
      variants: [
        {
          id: randomUUID(),
          productId: "",
          sku: "VST-TEST",
          size: "M",
          color: "سفید",
          price: null,
          stock: 5,
          version: 0,
        },
      ],
    });

    const res = await request(app)
      .patch(`/api/seller/products/${product.id}/status`)
      .set("Authorization", bearerFor(userId))
      .send({ status: "PUBLISHED" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("PUBLISHED");
  });

  it("خروج از ARCHIVED مجاز نیست (وضعیت پایانی)", async () => {
    const { app, repo } = buildProductsApp();
    const userId = randomUUID();
    const sellerId = repo.seedSeller(userId, "APPROVED");
    const categoryId = repo.seedActiveCategory();
    const product = repo.seedProduct({ sellerId, categoryId, status: "ARCHIVED" });

    const res = await request(app)
      .patch(`/api/seller/products/${product.id}/status`)
      .set("Authorization", bearerFor(userId))
      .send({ status: "DRAFT" });

    expect(res.status).toBe(409);
  });

  it("درخواست تغییر به همان وضعیت فعلی، بدون خطا و بدون تغییر است (Idempotent)", async () => {
    const { app, repo } = buildProductsApp();
    const userId = randomUUID();
    const sellerId = repo.seedSeller(userId, "APPROVED");
    const categoryId = repo.seedActiveCategory();
    const product = repo.seedProduct({ sellerId, categoryId, status: "DRAFT" });

    const res = await request(app)
      .patch(`/api/seller/products/${product.id}/status`)
      .set("Authorization", bearerFor(userId))
      .send({ status: "DRAFT" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("DRAFT");
  });

  it("مقدار وضعیت نامعتبر 400 می‌دهد", async () => {
    const { app, repo } = buildProductsApp();
    const userId = randomUUID();
    const sellerId = repo.seedSeller(userId, "APPROVED");
    const categoryId = repo.seedActiveCategory();
    const product = repo.seedProduct({ sellerId, categoryId });

    const res = await request(app)
      .patch(`/api/seller/products/${product.id}/status`)
      .set("Authorization", bearerFor(userId))
      .send({ status: "NOT_A_STATUS" });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/seller/products — فهرست و Pagination", () => {
  it("فقط محصولات همان فروشنده را برمی‌گرداند", async () => {
    const { app, repo } = buildProductsApp();
    const userId = randomUUID();
    const sellerId = repo.seedSeller(userId, "APPROVED");
    const categoryId = repo.seedActiveCategory();
    repo.seedProduct({ sellerId, categoryId, title: "محصول من ۱" });
    repo.seedProduct({ sellerId, categoryId, title: "محصول من ۲" });

    const otherUserId = randomUUID();
    const otherSellerId = repo.seedSeller(otherUserId, "APPROVED");
    repo.seedProduct({ sellerId: otherSellerId, categoryId, title: "محصول دیگری" });

    const res = await request(app)
      .get("/api/seller/products")
      .set("Authorization", bearerFor(userId));

    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(2);
    expect(res.body.data.pagination).toMatchObject({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });

  it("فیلتر status اعمال می‌شود", async () => {
    const { app, repo } = buildProductsApp();
    const userId = randomUUID();
    const sellerId = repo.seedSeller(userId, "APPROVED");
    const categoryId = repo.seedActiveCategory();
    repo.seedProduct({ sellerId, categoryId, status: "DRAFT" });
    repo.seedProduct({ sellerId, categoryId, status: "PUBLISHED" });

    const res = await request(app)
      .get("/api/seller/products?status=PUBLISHED")
      .set("Authorization", bearerFor(userId));

    expect(res.body.data.data).toHaveLength(1);
    expect(res.body.data.data[0].status).toBe("PUBLISHED");
  });

  it("limit خارج از محدوده 400 می‌دهد", async () => {
    const { app, repo } = buildProductsApp();
    const userId = randomUUID();
    repo.seedSeller(userId, "APPROVED");

    const res = await request(app)
      .get("/api/seller/products?limit=999")
      .set("Authorization", bearerFor(userId));

    expect(res.status).toBe(400);
  });
});
