import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { bearerFor } from "../helpers/authToken";
import { buildReviewsApp } from "../helpers/buildReviewsApp";

vi.mock("../../src/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("POST /api/products/:productId/reviews", () => {
  it("بدون ورود 401 می‌دهد", async () => {
    const { app } = buildReviewsApp();
    const res = await request(app)
      .post(`/api/products/${randomUUID()}/reviews`)
      .send({ rating: 5 });
    expect(res.status).toBe(401);
  });

  it("کاربری که خرید نکرده 403 می‌دهد (جلوگیری از ریویوی جعلی)", async () => {
    const { app } = buildReviewsApp();
    const userId = randomUUID();
    const productId = randomUUID();

    const res = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ rating: 5, comment: "عالی بود" });

    expect(res.status).toBe(403);
  });

  it("خریدار واقعی می‌تواند نظر ثبت کند", async () => {
    const { app, repo } = buildReviewsApp();
    const userId = randomUUID();
    const productId = randomUUID();
    repo.markPurchased(userId, productId);

    const res = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ rating: 4, comment: "خوب بود" });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ rating: 4, comment: "خوب بود", isMine: true });
  });

  it("ثبت نظر دوباره برای همان محصول 409 می‌دهد", async () => {
    const { app, repo } = buildReviewsApp();
    const userId = randomUUID();
    const productId = randomUUID();
    repo.markPurchased(userId, productId);
    await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ rating: 4 });

    const res = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ rating: 5 });

    expect(res.status).toBe(409);
  });

  it("امتیاز خارج از ۱ تا ۵ یا بدون امتیاز 400 می‌دهد", async () => {
    const { app, repo } = buildReviewsApp();
    const userId = randomUUID();
    const productId = randomUUID();
    repo.markPurchased(userId, productId);

    const zero = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ rating: 0 });
    const missing = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ comment: "بدون امتیاز" });

    expect(zero.status).toBe(400);
    expect(missing.status).toBe(400);
  });
});

describe("GET /api/products/:productId/reviews", () => {
  it("بدون ورود هم قابل مشاهده است (عمومی) و میانگین درست محاسبه می‌شود", async () => {
    const { app, repo } = buildReviewsApp();
    const productId = randomUUID();
    const buyerA = randomUUID();
    const buyerB = randomUUID();
    repo.markPurchased(buyerA, productId);
    repo.markPurchased(buyerB, productId);
    await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set("Authorization", bearerFor(buyerA, "CUSTOMER"))
      .send({ rating: 5 });
    await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set("Authorization", bearerFor(buyerB, "CUSTOMER"))
      .send({ rating: 3 });

    const res = await request(app).get(`/api/products/${productId}/reviews`);

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(2);
    expect(res.body.data.average).toBe(4);
    expect(res.body.data.reviews.every((r: { isMine: boolean }) => r.isMine === false)).toBe(true);
  });

  it("برای بیننده واردشده، isMine روی نظر خودش true است (optionalAuth)", async () => {
    const { app, repo } = buildReviewsApp();
    const productId = randomUUID();
    const owner = randomUUID();
    repo.markPurchased(owner, productId);
    await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set("Authorization", bearerFor(owner, "CUSTOMER"))
      .send({ rating: 5 });

    const res = await request(app)
      .get(`/api/products/${productId}/reviews`)
      .set("Authorization", bearerFor(owner, "CUSTOMER"));

    expect(res.body.data.reviews[0].isMine).toBe(true);
  });

  it("محصول بدون نظر: میانگین صفر و آرایه خالی", async () => {
    const { app } = buildReviewsApp();
    const res = await request(app).get(`/api/products/${randomUUID()}/reviews`);
    expect(res.body.data).toEqual({ reviews: [], average: 0, count: 0 });
  });

  it("productId نامعتبر در مسیر 400 می‌دهد", async () => {
    const { app } = buildReviewsApp();
    const res = await request(app).get("/api/products/not-a-uuid/reviews");
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/reviews/:id", () => {
  it("مالک نظرش را ویرایش می‌کند", async () => {
    const { app, repo } = buildReviewsApp();
    const userId = randomUUID();
    const productId = randomUUID();
    repo.markPurchased(userId, productId);
    const created = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ rating: 3, comment: "معمولی" });

    const res = await request(app)
      .patch(`/api/reviews/${created.body.data.id}`)
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ rating: 5, comment: "نظرم بهتر شد" });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ rating: 5, comment: "نظرم بهتر شد" });
  });

  it("کاربر دیگر نمی‌تواند ویرایش کند (404، نه فاش‌کردن مالکیت)", async () => {
    const { app, repo } = buildReviewsApp();
    const owner = randomUUID();
    const productId = randomUUID();
    repo.markPurchased(owner, productId);
    const created = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set("Authorization", bearerFor(owner, "CUSTOMER"))
      .send({ rating: 4 });

    const other = randomUUID();
    const res = await request(app)
      .patch(`/api/reviews/${created.body.data.id}`)
      .set("Authorization", bearerFor(other, "CUSTOMER"))
      .send({ rating: 1 });

    expect(res.status).toBe(404);
  });

  it("بدنه خالی 400 می‌دهد", async () => {
    const { app, repo } = buildReviewsApp();
    const userId = randomUUID();
    const productId = randomUUID();
    repo.markPurchased(userId, productId);
    const created = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ rating: 4 });

    const res = await request(app)
      .patch(`/api/reviews/${created.body.data.id}`)
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({});

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/reviews/:id", () => {
  it("مالک نظرش را حذف می‌کند", async () => {
    const { app, repo } = buildReviewsApp();
    const userId = randomUUID();
    const productId = randomUUID();
    repo.markPurchased(userId, productId);
    const created = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set("Authorization", bearerFor(userId, "CUSTOMER"))
      .send({ rating: 4 });

    const res = await request(app)
      .delete(`/api/reviews/${created.body.data.id}`)
      .set("Authorization", bearerFor(userId, "CUSTOMER"));
    const after = await request(app).get(`/api/products/${productId}/reviews`);

    expect(res.status).toBe(200);
    expect(after.body.data.count).toBe(0);
  });

  it("کاربر دیگر نمی‌تواند حذف کند (404)", async () => {
    const { app, repo } = buildReviewsApp();
    const owner = randomUUID();
    const productId = randomUUID();
    repo.markPurchased(owner, productId);
    const created = await request(app)
      .post(`/api/products/${productId}/reviews`)
      .set("Authorization", bearerFor(owner, "CUSTOMER"))
      .send({ rating: 4 });

    const other = randomUUID();
    const res = await request(app)
      .delete(`/api/reviews/${created.body.data.id}`)
      .set("Authorization", bearerFor(other, "CUSTOMER"));

    expect(res.status).toBe(404);
  });
});
