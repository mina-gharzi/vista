import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { bearerFor } from "../helpers/authToken";
import { buildWishlistApp } from "../helpers/buildWishlistApp";

vi.mock("../../src/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("GET /api/wishlist", () => {
  it("بدون ورود 401 می‌دهد", async () => {
    const { app } = buildWishlistApp();
    const res = await request(app).get("/api/wishlist");
    expect(res.status).toBe(401);
  });

  it("لیست خالی برمی‌گرداند", async () => {
    const { app } = buildWishlistApp();
    const userId = randomUUID();
    const res = await request(app)
      .get("/api/wishlist")
      .set("Authorization", bearerFor(userId, "CUSTOMER"));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe("POST /api/wishlist", () => {
  it("محصول ناموجود 404 می‌دهد", async () => {
    const { app } = buildWishlistApp();
    const userId = randomUUID();
    const res = await request(app)
      .post("/api/wishlist")
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ productId: randomUUID() });
    expect(res.status).toBe(404);
  });

  it("افزودن موفق", async () => {
    const { app, repo } = buildWishlistApp();
    const userId = randomUUID();
    const productId = repo.seedProduct({ title: "پیراهن کتان" });

    const res = await request(app)
      .post("/api/wishlist")
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ productId });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ productId, productTitle: "پیراهن کتان" });
  });

  it("افزودن دوباره همان محصول، خطا یا تکراری نمی‌سازد (Idempotent)", async () => {
    const { app, repo } = buildWishlistApp();
    const userId = randomUUID();
    const productId = repo.seedProduct();

    await request(app)
      .post("/api/wishlist")
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ productId });
    const res = await request(app)
      .post("/api/wishlist")
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ productId });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(1);
  });

  it("محصول DRAFT هم قابل افزودن است ولی isAvailable=false نشان می‌دهد", async () => {
    const { app, repo } = buildWishlistApp();
    const userId = randomUUID();
    const productId = repo.seedProduct({ status: "DRAFT" });

    const res = await request(app)
      .post("/api/wishlist")
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ productId });

    expect(res.status).toBe(201);
    expect(res.body.data[0].isAvailable).toBe(false);
  });

  it("productId نامعتبر 400 می‌دهد", async () => {
    const { app } = buildWishlistApp();
    const userId = randomUUID();
    const res = await request(app)
      .post("/api/wishlist")
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ productId: "not-a-uuid" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/wishlist/:productId", () => {
  it("وضعیت افزوده‌نشده را false برمی‌گرداند", async () => {
    const { app, repo } = buildWishlistApp();
    const userId = randomUUID();
    const productId = repo.seedProduct();

    const res = await request(app)
      .get(`/api/wishlist/${productId}`)
      .set("Authorization", bearerFor(userId, "CUSTOMER"));

    expect(res.body.data).toEqual({ isWishlisted: false });
  });

  it("بعد از افزودن true برمی‌گرداند", async () => {
    const { app, repo } = buildWishlistApp();
    const userId = randomUUID();
    const productId = repo.seedProduct();
    await request(app)
      .post("/api/wishlist")
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ productId });

    const res = await request(app)
      .get(`/api/wishlist/${productId}`)
      .set("Authorization", bearerFor(userId, "CUSTOMER"));

    expect(res.body.data).toEqual({ isWishlisted: true });
  });
});

describe("DELETE /api/wishlist/:productId", () => {
  it("حذف موفق", async () => {
    const { app, repo } = buildWishlistApp();
    const userId = randomUUID();
    const productId = repo.seedProduct();
    await request(app)
      .post("/api/wishlist")
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ productId });

    const res = await request(app)
      .delete(`/api/wishlist/${productId}`)
      .set("Authorization", bearerFor(userId, "CUSTOMER"));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("حذف محصول غیرموجود در لیست هم خطا نمی‌دهد (Idempotent)", async () => {
    const { app, repo } = buildWishlistApp();
    const userId = randomUUID();
    const productId = repo.seedProduct();

    const res = await request(app)
      .delete(`/api/wishlist/${productId}`)
      .set("Authorization", bearerFor(userId, "CUSTOMER"));

    expect(res.status).toBe(200);
  });
});

describe("مالکیت — Wishlistهای کاربران جدا هستند", () => {
  it("افزودن یک کاربر، Wishlist کاربر دیگر را تغییر نمی‌دهد", async () => {
    const { app, repo } = buildWishlistApp();
    const userA = randomUUID();
    const userB = randomUUID();
    const productId = repo.seedProduct();

    await request(app)
      .post("/api/wishlist")
      .set("Authorization", bearerFor(userA, "CUSTOMER"))
      .send({ productId });

    const wishlistB = await request(app)
      .get("/api/wishlist")
      .set("Authorization", bearerFor(userB, "CUSTOMER"));

    expect(wishlistB.body.data).toEqual([]);
  });
});
