import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { bearerFor } from "../helpers/authToken";
import { buildCartApp } from "../helpers/buildCartApp";

vi.mock("../../src/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("GET /api/cart", () => {
  it("بدون ورود 401 می‌دهد", async () => {
    const { app } = buildCartApp();
    const res = await request(app).get("/api/cart");
    expect(res.status).toBe(401);
  });

  it("سبد خالی، آرایه خالی و subtotal صفر می‌دهد", async () => {
    const { app } = buildCartApp();
    const userId = randomUUID();

    const res = await request(app)
      .get("/api/cart")
      .set("Authorization", bearerFor(userId, "CUSTOMER"));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ items: [], itemCount: 0, subtotal: 0 });
  });
});

describe("POST /api/cart", () => {
  it("کالای منتشرنشده/ناموجود را نمی‌پذیرد (404)", async () => {
    const { app } = buildCartApp();
    const userId = randomUUID();

    const res = await request(app)
      .post("/api/cart")
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ variantId: randomUUID(), quantity: 1 });

    expect(res.status).toBe(404);
  });

  it("کالای محصول DRAFT را نمی‌پذیرد", async () => {
    const { app, repo } = buildCartApp();
    const userId = randomUUID();
    const variantId = repo.seedVariant({
      size: "M",
      color: "مشکی",
      stock: 10,
      productStatus: "DRAFT",
    });

    const res = await request(app)
      .post("/api/cart")
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ variantId, quantity: 1 });

    expect(res.status).toBe(404);
  });

  it("افزودن موفق با قیمت و جمع درست", async () => {
    const { app, repo } = buildCartApp();
    const userId = randomUUID();
    const variantId = repo.seedVariant({ size: "M", color: "مشکی", stock: 10, basePrice: 200_000 });

    const res = await request(app)
      .post("/api/cart")
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ variantId, quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]).toMatchObject({
      quantity: 2,
      unitPrice: 200_000,
      lineTotal: 400_000,
    });
    expect(res.body.data.itemCount).toBe(2);
    expect(res.body.data.subtotal).toBe(400_000);
  });

  it("افزودن دوباره همان Variant، تعداد را جمع می‌زند نه جایگزین", async () => {
    const { app, repo } = buildCartApp();
    const userId = randomUUID();
    const variantId = repo.seedVariant({ size: "M", color: "مشکی", stock: 10 });

    await request(app)
      .post("/api/cart")
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ variantId, quantity: 3 });
    const res = await request(app)
      .post("/api/cart")
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ variantId, quantity: 2 });

    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].quantity).toBe(5);
  });

  it("بیشتر از موجودی رد می‌شود (۴۰۹) و سبد قبلی دست‌نخورده می‌ماند", async () => {
    const { app, repo } = buildCartApp();
    const userId = randomUUID();
    const variantId = repo.seedVariant({ size: "M", color: "مشکی", stock: 5 });

    await request(app)
      .post("/api/cart")
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ variantId, quantity: 4 });
    const res = await request(app)
      .post("/api/cart")
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ variantId, quantity: 2 }); // 4+2=6 > stock=5

    expect(res.status).toBe(409);
    const cart = await request(app)
      .get("/api/cart")
      .set("Authorization", bearerFor(userId, "CUSTOMER"));
    expect(cart.body.data.items[0].quantity).toBe(4);
  });

  it("قیمت Variant بر basePrice محصول اولویت دارد", async () => {
    const { app, repo } = buildCartApp();
    const userId = randomUUID();
    const variantId = repo.seedVariant({
      size: "M",
      color: "مشکی",
      stock: 10,
      basePrice: 200_000,
      price: 180_000,
    });

    const res = await request(app)
      .post("/api/cart")
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ variantId, quantity: 1 });

    expect(res.body.data.items[0].unitPrice).toBe(180_000);
  });

  it("تعداد صفر یا منفی 400 می‌دهد", async () => {
    const { app, repo } = buildCartApp();
    const userId = randomUUID();
    const variantId = repo.seedVariant({ size: "M", color: "مشکی", stock: 10 });

    const res = await request(app)
      .post("/api/cart")
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ variantId, quantity: 0 });

    expect(res.status).toBe(400);
  });

  it("quantity بدون مقدار پیش‌فرض ۱ می‌گیرد", async () => {
    const { app, repo } = buildCartApp();
    const userId = randomUUID();
    const variantId = repo.seedVariant({ size: "M", color: "مشکی", stock: 10 });

    const res = await request(app)
      .post("/api/cart")
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ variantId });

    expect(res.body.data.items[0].quantity).toBe(1);
  });
});

describe("PATCH /api/cart/:variantId", () => {
  it("کالایی که در سبد نیست 404 می‌دهد", async () => {
    const { app, repo } = buildCartApp();
    const userId = randomUUID();
    const variantId = repo.seedVariant({ size: "M", color: "مشکی", stock: 10 });

    const res = await request(app)
      .patch(`/api/cart/${variantId}`)
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ quantity: 2 });

    expect(res.status).toBe(404);
  });

  it("به‌روزرسانی موفق تعداد", async () => {
    const { app, repo } = buildCartApp();
    const userId = randomUUID();
    const variantId = repo.seedVariant({ size: "M", color: "مشکی", stock: 10 });
    await request(app)
      .post("/api/cart")
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ variantId, quantity: 1 });

    const res = await request(app)
      .patch(`/api/cart/${variantId}`)
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ quantity: 7 });

    expect(res.status).toBe(200);
    expect(res.body.data.items[0].quantity).toBe(7);
  });

  it("بیشتر از موجودی 400 می‌دهد", async () => {
    const { app, repo } = buildCartApp();
    const userId = randomUUID();
    const variantId = repo.seedVariant({ size: "M", color: "مشکی", stock: 3 });
    await request(app)
      .post("/api/cart")
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ variantId, quantity: 1 });

    const res = await request(app)
      .patch(`/api/cart/${variantId}`)
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ quantity: 10 });

    expect(res.status).toBe(400);
  });

  it("مقدار صفر رد می‌شود — باید از DELETE استفاده شود", async () => {
    const { app, repo } = buildCartApp();
    const userId = randomUUID();
    const variantId = repo.seedVariant({ size: "M", color: "مشکی", stock: 10 });
    await request(app)
      .post("/api/cart")
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ variantId, quantity: 1 });

    const res = await request(app)
      .patch(`/api/cart/${variantId}`)
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ quantity: 0 });

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/cart/:variantId", () => {
  it("حذف موفق از سبد", async () => {
    const { app, repo } = buildCartApp();
    const userId = randomUUID();
    const variantId = repo.seedVariant({ size: "M", color: "مشکی", stock: 10 });
    await request(app)
      .post("/api/cart")
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ variantId, quantity: 1 });

    const res = await request(app)
      .delete(`/api/cart/${variantId}`)
      .set("Authorization", bearerFor(userId, "CUSTOMER"));

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it("حذف کالای غیرموجود هم خطا نمی‌دهد (Idempotent)", async () => {
    const { app, repo } = buildCartApp();
    const userId = randomUUID();
    const variantId = repo.seedVariant({ size: "M", color: "مشکی", stock: 10 });

    const res = await request(app)
      .delete(`/api/cart/${variantId}`)
      .set("Authorization", bearerFor(userId, "CUSTOMER"));

    expect(res.status).toBe(200);
  });
});

describe("مالکیت — سبدهای کاربران جدا هستند", () => {
  it("افزودن به سبد یک کاربر، سبد کاربر دیگر را تغییر نمی‌دهد", async () => {
    const { app, repo } = buildCartApp();
    const userA = randomUUID();
    const userB = randomUUID();
    const variantId = repo.seedVariant({ size: "M", color: "مشکی", stock: 10 });

    await request(app)
      .post("/api/cart")
      .set("Authorization", bearerFor(userA, "CUSTOMER"))
      .send({ variantId, quantity: 3 });

    const cartB = await request(app)
      .get("/api/cart")
      .set("Authorization", bearerFor(userB, "CUSTOMER"));

    expect(cartB.body.data.items).toEqual([]);
  });
});

describe("isAvailable در پاسخ سبد", () => {
  it("وقتی موجودی بعداً به کمتر از quantity می‌رسد، isAvailable=false می‌شود", async () => {
    const { app, repo } = buildCartApp();
    const userId = randomUUID();
    const variantId = repo.seedVariant({ size: "M", color: "مشکی", stock: 10 });
    await request(app)
      .post("/api/cart")
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ variantId, quantity: 5 });

    repo.setStock(variantId, 2); // فروشنده بعداً موجودی را کم می‌کند

    const res = await request(app)
      .get("/api/cart")
      .set("Authorization", bearerFor(userId, "CUSTOMER"));

    expect(res.body.data.items[0].isAvailable).toBe(false);
    expect(res.body.data.items[0].availableStock).toBe(2);
  });

  it("وقتی محصول بعداً آرشیو می‌شود، isAvailable=false می‌شود", async () => {
    const { app, repo } = buildCartApp();
    const userId = randomUUID();
    const variantId = repo.seedVariant({ size: "M", color: "مشکی", stock: 10 });
    await request(app)
      .post("/api/cart")
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ variantId, quantity: 1 });

    repo.setProductStatus(variantId, "ARCHIVED");

    const res = await request(app)
      .get("/api/cart")
      .set("Authorization", bearerFor(userId, "CUSTOMER"));

    expect(res.body.data.items[0].isAvailable).toBe(false);
  });
});
