import express, { type Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { errorHandler } from "../../src/middlewares/errorHandler";
import { createInventoryController } from "../../src/modules/inventory/inventory.controller";
import { createInventoryRepository } from "../../src/modules/inventory/inventory.repository";
import { createInventoryRouter } from "../../src/modules/inventory/inventory.routes";
import { createInventoryService } from "../../src/modules/inventory/inventory.service";
import { signAccessToken } from "../../src/utils/tokens";
import { createFakeInventoryRepository } from "../helpers/fakeInventoryRepository";

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
const MISSING = "00000000-0000-4000-8000-999999999999";

let app: Express;
let fake: ReturnType<typeof createFakeInventoryRepository>;
let productA: string;
let productB: string;
let variantA: string; // stock 10
let variantB: string; // seller B

const auth = (userId: string, role: "CUSTOMER" | "SELLER" | "ADMIN" = "SELLER") =>
  `Bearer ${signAccessToken({ userId, role })}`;
const asA = () => ({ Authorization: auth(USER_A) });
const url = (suffix = "") => `/api/seller/inventory${suffix}`;

beforeEach(() => {
  fake = createFakeInventoryRepository();
  const sellerA = fake.addSeller(USER_A, "APPROVED");
  const sellerB = fake.addSeller(USER_B, "APPROVED");
  fake.addSeller(PENDING_USER, "PENDING");
  fake.addUser(USER_A, "فروشنده الف");
  fake.addUser(CUSTOMER, "مشتری محرمانه");
  productA = fake.addProduct(sellerA, "پیراهن کتان");
  productB = fake.addProduct(sellerB, "کفش چرم");
  variantA = fake.addVariant(productA, { sku: "A-1", stock: 10 });
  variantB = fake.addVariant(productB, { sku: "B-1", stock: 7 });

  app = express();
  app.use(express.json());
  app.use(
    "/api/seller/inventory",
    createInventoryRouter(createInventoryController(createInventoryService(fake.repository))),
  );
  app.use(errorHandler);
});

describe("دسترسی", () => {
  it("1) بدون احراز هویت → 401 (هم خواندن، هم تغییر)", async () => {
    expect((await request(app).get(url())).status).toBe(401);
    expect((await request(app).post(url(`/${variantA}/restock`)).send({ quantity: 1, reason: "تست" })).status).toBe(401);
  });

  it("2) مشتری نمی‌تواند موجودی را تغییر دهد → 403 و موجودی دست‌نخورده", async () => {
    const res = await request(app)
      .post(url(`/${variantA}/restock`))
      .set("Authorization", auth(CUSTOMER, "CUSTOMER"))
      .send({ quantity: 5, reason: "حمله" });
    expect(res.status).toBe(403);
    expect(fake.variants.find((v) => v.id === variantA)?.stock).toBe(10);
    expect(fake.movements).toHaveLength(0);
  });

  it("2b) مشتری با بدنه نامعتبر هم 403 می‌گیرد، نه 400", async () => {
    const res = await request(app)
      .post(url(`/${variantA}/adjust`))
      .set("Authorization", auth(CUSTOMER, "CUSTOMER"))
      .send({});
    expect(res.status).toBe(403);
  });

  it("3) فروشنده تأییدنشده نمی‌تواند تغییر دهد یا ببیند → 403", async () => {
    const h = { Authorization: auth(PENDING_USER) };
    expect((await request(app).get(url()).set(h)).status).toBe(403);
    const res = await request(app).post(url(`/${variantA}/restock`)).set(h).send({ quantity: 1, reason: "تست" });
    expect(res.status).toBe(403);
    expect(fake.movements).toHaveLength(0);
  });

  it("4) فروشنده تأییدشده فقط موجودی خودش را می‌بیند (حتی با توکن کهنه CUSTOMER)", async () => {
    const res = await request(app).get(url()).set("Authorization", auth(USER_A, "CUSTOMER"));
    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(1);
    expect(res.body.data.data[0]).toMatchObject({ variantId: variantA, sku: "A-1", stock: 10, status: "IN_STOCK" });
    expect(JSON.stringify(res.body)).not.toContain("B-1");
  });
});

describe("Restock", () => {
  it("5) موجودی را درست زیاد می‌کند و دقیقاً یک Movement می‌سازد", async () => {
    const res = await request(app)
      .post(url(`/${variantA}/restock`))
      .set(asA())
      .send({ quantity: 15, reason: "ورود محموله جدید" });
    expect(res.status).toBe(200);
    expect(res.body.data.item.stock).toBe(25);
    expect(res.body.data.movement).toMatchObject({
      type: "RESTOCK",
      quantityDelta: 15,
      stockBefore: 10,
      stockAfter: 25,
      reason: "ورود محموله جدید",
      actorName: "فروشنده الف",
    });
    expect(fake.movements).toHaveLength(1);
    expect(fake.movements[0]).toMatchObject({ variantId: variantA, actorId: USER_A });
  });

  it("8) مقدارهای نامعتبر رد می‌شوند و چیزی ثبت نمی‌شود", async () => {
    const bad = [
      { quantity: 0, reason: "تست دلیل" },
      { quantity: -3, reason: "تست دلیل" },
      { quantity: 1.5, reason: "تست دلیل" },
      { quantity: "5", reason: "تست دلیل" },
      { quantity: 2_000_000, reason: "تست دلیل" },
      { quantity: 5 },
      { quantity: 5, reason: "  " },
    ];
    for (const body of bad) {
      const res = await request(app).post(url(`/${variantA}/restock`)).set(asA()).send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect(fake.variants.find((v) => v.id === variantA)?.stock).toBe(10);
    expect(fake.movements).toHaveLength(0);
  });

  it("شناسه نامعتبر → 400 و ناموجود → 404", async () => {
    expect((await request(app).post(url("/abc/restock")).set(asA()).send({ quantity: 1, reason: "تست دلیل" })).status).toBe(400);
    expect((await request(app).post(url(`/${MISSING}/restock`)).set(asA()).send({ quantity: 1, reason: "تست دلیل" })).status).toBe(404);
  });

  it("سقف موجودی رعایت می‌شود → 409", async () => {
    const res = await request(app)
      .post(url(`/${variantA}/restock`))
      .set(asA())
      .send({ quantity: 1_000_000, reason: "تست سقف" });
    expect(res.status).toBe(409);
    expect(fake.movements).toHaveLength(0);
  });
});

describe("Adjust", () => {
  it("6) با موجودی جدید: Delta و موجودی نهایی درست ثبت می‌شود", async () => {
    const res = await request(app)
      .post(url(`/${variantA}/adjust`))
      .set(asA())
      .send({ newQuantity: 4, reason: "شمارش انبار" });
    expect(res.status).toBe(200);
    expect(res.body.data.item).toMatchObject({ stock: 4, status: "LOW_STOCK" });
    expect(res.body.data.movement).toMatchObject({
      type: "ADJUSTMENT",
      quantityDelta: -6,
      stockBefore: 10,
      stockAfter: 4,
    });
    expect(fake.movements).toHaveLength(1);
  });

  it("6b) با Delta علامت‌دار (مثبت و منفی) و رسیدن به صفر → ناموجود", async () => {
    let res = await request(app).post(url(`/${variantA}/adjust`)).set(asA()).send({ delta: 3, reason: "پیدا شد" });
    expect(res.body.data.item.stock).toBe(13);
    res = await request(app).post(url(`/${variantA}/adjust`)).set(asA()).send({ delta: -13, reason: "مرجوعی خراب" });
    expect(res.body.data.item).toMatchObject({ stock: 0, status: "OUT_OF_STOCK" });
    expect(fake.movements).toHaveLength(2);
  });

  it("7) موجودی منفی رد می‌شود (Delta منفی بزرگ → 409، newQuantity منفی → 400)", async () => {
    let res = await request(app).post(url(`/${variantA}/adjust`)).set(asA()).send({ delta: -11, reason: "اشتباه" });
    expect(res.status).toBe(409);
    res = await request(app).post(url(`/${variantA}/adjust`)).set(asA()).send({ newQuantity: -1, reason: "اشتباه" });
    expect(res.status).toBe(400);
    expect(fake.variants.find((v) => v.id === variantA)?.stock).toBe(10);
    expect(fake.movements).toHaveLength(0);
  });

  it("8b) دلیل اجباری؛ فقط یکی از newQuantity/delta؛ بدون تغییر رد می‌شود", async () => {
    const bad = [
      { newQuantity: 5 },
      { newQuantity: 5, reason: "ab" },
      { reason: "بدون مقدار" },
      { newQuantity: 5, delta: 1, reason: "هر دو" },
      { newQuantity: 2.5, reason: "اعشار" },
      { delta: 0.5, reason: "اعشار" },
    ];
    for (const body of bad) {
      const res = await request(app).post(url(`/${variantA}/adjust`)).set(asA()).send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    const same = await request(app).post(url(`/${variantA}/adjust`)).set(asA()).send({ newQuantity: 10, reason: "بدون تغییر" });
    expect(same.status).toBe(400);
    const zero = await request(app).post(url(`/${variantA}/adjust`)).set(asA()).send({ delta: 0, reason: "بدون تغییر" });
    expect(zero.status).toBe(400);
    expect(fake.movements).toHaveLength(0);
  });

  it("هویت و فروشنده از Body پذیرفته نمی‌شوند", async () => {
    await request(app)
      .post(url(`/${variantA}/restock`))
      .set(asA())
      .send({ quantity: 1, reason: "تست دلیل", actorId: USER_B, sellerId: "x", userId: USER_B });
    expect(fake.movements[0]?.actorId).toBe(USER_A);
  });

  it("Variant آرشیوشده قابل تغییر نیست → 409", async () => {
    const archived = fake.addVariant(productA, { sku: "A-OLD", isActive: false });
    const res = await request(app).post(url(`/${archived}/restock`)).set(asA()).send({ quantity: 1, reason: "تست دلیل" });
    expect(res.status).toBe(409);
  });
});

describe("یکپارچگی و همزمانی", () => {
  it("9) هر تغییر موفق دقیقاً یک Movement؛ تغییر ناموفق هیچ Movement ندارد", async () => {
    await request(app).post(url(`/${variantA}/restock`)).set(asA()).send({ quantity: 2, reason: "ورود اول" });
    await request(app).post(url(`/${variantA}/adjust`)).set(asA()).send({ delta: -1, reason: "کسر دستی" });
    await request(app).post(url(`/${variantA}/adjust`)).set(asA()).send({ delta: -500, reason: "رد شدنی" });
    expect(fake.movements.map((m) => m.type)).toEqual(["RESTOCK", "ADJUSTMENT"]);
  });

  it("10) خطا بعد از به‌روزرسانی موجودی → Rollback کامل و پاسخ 500 بدون جزئیات داخلی", async () => {
    fake.faults.failAfterStockUpdate = true;
    const res = await request(app).post(url(`/${variantA}/restock`)).set(asA()).send({ quantity: 5, reason: "تست خطا" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("injected failure");
    expect(fake.variants.find((v) => v.id === variantA)?.stock).toBe(10);
    expect(fake.movements).toHaveLength(0);
  });

  it("10b) Repository واقعی هر دو نوشتن را فقط داخل Transaction انجام می‌دهد", async () => {
    const calls: string[] = [];
    const state = { stock: 10, movements: 0 };
    const tx = {
      $queryRaw: async () => [{ stock: state.stock, isActive: true, productStatus: "PUBLISHED" }],
      productVariant: {
        update: async (args: { data: { stock: number } }) => {
          calls.push("tx.update");
          state.stock = args.data.stock;
          return { id: "v" };
        },
        findUniqueOrThrow: async () => ({
          id: "v", productId: "p", size: "M", color: "c", sku: "S", stock: state.stock, isActive: true,
          product: { title: "t", status: "PUBLISHED" }, inventoryMovements: [],
        }),
      },
      inventoryMovement: {
        create: async () => {
          calls.push("tx.movement");
          throw new Error("db down");
        },
      },
    };
    const outside = () => {
      throw new Error("نوشتن خارج از Transaction");
    };
    const prisma = {
      productVariant: { update: outside, updateMany: outside },
      inventoryMovement: { create: outside },
      // Rollback: اگر callback خطا بدهد، وضعیت به Snapshot برمی‌گردد
      $transaction: async (work: (t: typeof tx) => Promise<unknown>) => {
        const snapshot = { ...state };
        try {
          return await work(tx);
        } catch (error) {
          Object.assign(state, snapshot);
          throw error;
        }
      },
    } as unknown as PrismaClient;

    const repo = createInventoryRepository(prisma);
    await expect(
      repo.applyStockChange("s", "v", { kind: "DELTA", delta: 5 }, { type: "RESTOCK", reason: "تست", actorId: "u" }),
    ).rejects.toThrow("db down");
    expect(calls).toEqual(["tx.update", "tx.movement"]);
    expect(state.stock).toBe(10);
  });

  it("13) درخواست‌های همزمان: هیچ Delta گم نمی‌شود و Movementها با زنجیره موجودی می‌خوانند", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        request(app).post(url(`/${variantA}/restock`)).set(asA()).send({ quantity: 1, reason: `همزمان ${i}` }),
      ),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(fake.variants.find((v) => v.id === variantA)?.stock).toBe(30);
    expect(fake.movements).toHaveLength(20);
    // زنجیره: هر stockAfter = stockAfter قبلی + delta
    let running = 10;
    for (const m of fake.movements) {
      running += m.quantityDelta;
      expect(m.stockAfter).toBe(running);
    }
  });

  it("13b) کسرهای همزمان هرگز موجودی را منفی نمی‌کنند", async () => {
    const results = await Promise.all(
      Array.from({ length: 15 }, () =>
        request(app).post(url(`/${variantA}/adjust`)).set(asA()).send({ delta: -1, reason: "فروش دستی" }),
      ),
    );
    const ok = results.filter((r) => r.status === 200).length;
    const rejected = results.filter((r) => r.status === 409).length;
    expect(ok).toBe(10);
    expect(rejected).toBe(5);
    expect(fake.variants.find((v) => v.id === variantA)?.stock).toBe(0);
    expect(fake.movements).toHaveLength(10);
  });
});

describe("جداسازی فروشندگان", () => {
  it("11) فروشنده A نمی‌تواند Variant فروشنده B را تغییر دهد → 404 و بدون اثر", async () => {
    const r1 = await request(app).post(url(`/${variantB}/restock`)).set(asA()).send({ quantity: 5, reason: "تست دلیل" });
    const r2 = await request(app).post(url(`/${variantB}/adjust`)).set(asA()).send({ newQuantity: 0, reason: "تست دلیل" });
    expect(r1.status).toBe(404);
    expect(r2.status).toBe(404);
    expect(fake.variants.find((v) => v.id === variantB)?.stock).toBe(7);
    expect(fake.movements).toHaveLength(0);
  });

  it("12) فروشنده A نمی‌تواند تاریخچه Variant فروشنده B را ببیند → 404", async () => {
    fake.addMovement(variantB, { type: "INITIAL", quantityDelta: 7, stockAfter: 7 });
    const res = await request(app).get(url(`/${variantB}/movements`)).set(asA());
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain("کفش چرم");
  });
});

describe("تاریخچه Movement", () => {
  it("جدیدترین اول، با صفحه‌بندی، و نام مشتری در حرکت سفارش هرگز نمی‌آید", async () => {
    fake.addMovement(variantA, { type: "INITIAL", quantityDelta: 10, stockAfter: 10, actorId: USER_A });
    fake.addMovement(variantA, { type: "ORDER_PLACED", quantityDelta: -2, stockAfter: 8, actorId: CUSTOMER, orderId: MISSING });
    await request(app).post(url(`/${variantA}/restock`)).set(asA()).send({ quantity: 2, reason: "ورود کالا" });

    const res = await request(app).get(url(`/${variantA}/movements?limit=2&page=1`)).set(asA());
    expect(res.status).toBe(200);
    expect(res.body.data.variant).toMatchObject({ variantId: variantA, productTitle: "پیراهن کتان" });
    expect(res.body.data.data.map((m: { type: string }) => m.type)).toEqual(["RESTOCK", "ORDER_PLACED"]);
    expect(res.body.data.pagination).toMatchObject({ total: 3, totalPages: 2, page: 1, limit: 2 });
    const order = res.body.data.data[1];
    expect(order).toMatchObject({ actorName: null, orderId: MISSING, stockBefore: 10, stockAfter: 8 });
    expect(JSON.stringify(res.body)).not.toContain("مشتری محرمانه");

    const page2 = await request(app).get(url(`/${variantA}/movements?limit=2&page=2`)).set(asA());
    expect(page2.body.data.data.map((m: { type: string }) => m.type)).toEqual(["INITIAL"]);
  });

  it("API ویرایش/حذف Movement وجود ندارد", async () => {
    for (const method of ["put", "patch", "delete"] as const) {
      const res = await request(app)[method](url(`/${variantA}/movements`)).set(asA());
      expect(res.status).toBe(404);
    }
  });
});

describe("لیست، فیلتر و صفحه‌بندی", () => {
  beforeEach(() => {
    fake.addVariant(productA, { sku: "A-2", stock: 0, color: "سفید" });
    fake.addVariant(productA, { sku: "A-3", stock: 5, color: "آبی" }); // آستانه = LOW
    fake.addVariant(productA, { sku: "A-4", stock: 6, color: "قرمز" }); // بالاتر از آستانه
    fake.addVariant(productA, { sku: "A-OLD", stock: 0, isActive: false }); // آرشیو: نمایش داده نمی‌شود
    const archivedProduct = fake.addProduct(fake.addSeller("55555555-5555-4555-8555-555555555555", "APPROVED"), "x", "ARCHIVED");
    fake.addVariant(archivedProduct);
    const draft = fake.addProduct(fake.addSeller("66666666-6666-4666-8666-666666666666", "APPROVED"), "y", "DRAFT");
    fake.addVariant(draft);
  });

  it("14) خلاصه سمت سرور و مستقل از فیلتر است", async () => {
    const res = await request(app).get(url("?status=OUT_OF_STOCK")).set(asA());
    expect(res.status).toBe(200);
    expect(res.body.data.data.map((i: { sku: string }) => i.sku)).toEqual(["A-2"]);
    expect(res.body.data.summary).toEqual({
      totalVariants: 4,
      inStockCount: 2,
      lowStockCount: 1,
      outOfStockCount: 1,
      totalUnits: 21,
      lowStockThreshold: 5,
    });
  });

  it("14b) فیلتر وضعیت‌ها مرزها را درست رعایت می‌کند", async () => {
    const skus = async (status: string) =>
      (await request(app).get(url(`?status=${status}`)).set(asA())).body.data.data
        .map((i: { sku: string }) => i.sku)
        .sort();
    expect(await skus("IN_STOCK")).toEqual(["A-1", "A-4"]);
    expect(await skus("LOW_STOCK")).toEqual(["A-3"]);
    expect(await skus("OUT_OF_STOCK")).toEqual(["A-2"]);
  });

  it("14c) جستجو در SKU، رنگ و عنوان؛ صفحه‌بندی total درست می‌دهد", async () => {
    const bySku = await request(app).get(url("?q=a-3")).set(asA());
    expect(bySku.body.data.data).toHaveLength(1);
    const byColor = await request(app).get(url(`?q=${encodeURIComponent("سفید")}`)).set(asA());
    expect(byColor.body.data.data.map((i: { sku: string }) => i.sku)).toEqual(["A-2"]);
    const byTitle = await request(app).get(url(`?q=${encodeURIComponent("کتان")}`)).set(asA());
    expect(byTitle.body.data.pagination.total).toBe(4);

    const p1 = await request(app).get(url("?limit=3&page=1")).set(asA());
    const p2 = await request(app).get(url("?limit=3&page=2")).set(asA());
    expect(p1.body.data.data).toHaveLength(3);
    expect(p2.body.data.data).toHaveLength(1);
    expect(p1.body.data.pagination).toMatchObject({ total: 4, totalPages: 2 });
  });

  it("پارامترهای نامعتبر → 400", async () => {
    expect((await request(app).get(url("?status=BAD")).set(asA())).status).toBe(400);
    expect((await request(app).get(url("?page=0")).set(asA())).status).toBe(400);
    expect((await request(app).get(url("?limit=500")).set(asA())).status).toBe(400);
  });

  it("فیلد lastMovementAt از آخرین Movement می‌آید", async () => {
    await request(app).post(url(`/${variantA}/restock`)).set(asA()).send({ quantity: 1, reason: "ورود کالا" });
    const res = await request(app).get(url("?q=A-1")).set(asA());
    expect(res.body.data.data[0].lastMovementAt).toEqual(expect.any(String));
    const other = await request(app).get(url("?q=A-2")).set(asA());
    expect(other.body.data.data[0].lastMovementAt).toBeNull();
  });
});
