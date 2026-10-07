import express, { type Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../src/middlewares/errorHandler";
import { createSellerDashboardController } from "../../src/modules/sellerDashboard/sellerDashboard.controller";
import { createSellerDashboardRouter } from "../../src/modules/sellerDashboard/sellerDashboard.routes";
import { createSellerDashboardService } from "../../src/modules/sellerDashboard/sellerDashboard.service";
import { signAccessToken } from "../../src/utils/tokens";
import { createFakeDashboardRepository } from "../helpers/fakeDashboardRepository";

// env.ts در زمان Import اعتبارسنجی می‌شود؛ vi.hoisted قبل از همه Importها اجرا می‌شود
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
const REJECTED_USER = "55555555-5555-4555-8555-555555555555";
const SUSPENDED_USER = "66666666-6666-4666-8666-666666666666";

type Fake = ReturnType<typeof createFakeDashboardRepository>;

let app: Express;
let fake: Fake;
let sellerA: string;
let sellerB: string;

const tokenFor = (userId: string, role: "CUSTOMER" | "SELLER" | "ADMIN" = "SELLER") =>
  `Bearer ${signAccessToken({ userId, role })}`;

const getDashboard = (userId: string, role?: "CUSTOMER" | "SELLER" | "ADMIN", query = "") =>
  request(app)
    .get(`/api/seller/dashboard${query}`)
    .set("Authorization", tokenFor(userId, role));

beforeEach(() => {
  fake = createFakeDashboardRepository();

  // --- فروشنده A ---
  sellerA = fake.addSeller(USER_A, "APPROVED", "store-a", "فروشگاه الف");
  const coatA = fake.addProduct(sellerA, "کت الف");
  fake.addVariant(coatA, 2, "M", "مشکی"); // رو به اتمام
  fake.addVariant(coatA, 0, "L", "مشکی"); // ناموجود
  fake.addVariant(coatA, 40, "S", "سفید"); // سالم
  const draftA = fake.addProduct(sellerA, "پیش‌نویس الف", "DRAFT");
  fake.addVariant(draftA, 0); // پیش‌نویس: در هشدار موجودی نمی‌آید
  fake.addProduct(sellerA, "آرشیو الف", "ARCHIVED");

  fake.addSellerOrder(sellerA, { orderNumber: 1001, subtotal: 1_000_000, status: "PENDING", quantities: [1, 2] });
  fake.addSellerOrder(sellerA, { orderNumber: 1002, subtotal: 500_000, status: "PROCESSING" });
  fake.addSellerOrder(sellerA, { orderNumber: 1003, subtotal: 2_000_000, status: "SHIPPED" });
  fake.addSellerOrder(sellerA, { orderNumber: 1004, subtotal: 3_000_000, status: "DELIVERED" });
  fake.addSellerOrder(sellerA, { orderNumber: 1005, subtotal: 700_000, status: "CANCELLED" }); // فروش حساب نمی‌شود
  fake.addSellerOrder(sellerA, { orderNumber: 1006, subtotal: 9_000_000, paymentStatus: "PENDING" }); // پرداخت‌نشده
  fake.addSellerOrder(sellerA, { orderNumber: 1007, subtotal: 8_000_000, paymentStatus: "REFUNDED" });

  // --- فروشنده B (داده‌ای که هرگز نباید به A برسد) ---
  sellerB = fake.addSeller(USER_B, "APPROVED", "store-b", "فروشگاه ب");
  const dressB = fake.addProduct(sellerB, "پیراهن ب");
  fake.addVariant(dressB, 1, "XL", "قرمز");
  fake.addVariant(dressB, 3, "XS", "آبی");
  fake.addVariant(dressB, 0, "M", "سبز");
  fake.addVariant(dressB, 0, "L", "سبز");
  fake.addProduct(sellerB, "محصول دیگر ب");
  fake.addProduct(sellerB, "محصول سوم ب");
  fake.addSellerOrder(sellerB, { orderNumber: 2001, subtotal: 50_000_000, status: "DELIVERED" });
  fake.addSellerOrder(sellerB, { orderNumber: 2002, subtotal: 40_000_000, status: "PENDING" });

  // --- فروشنده‌هایی که تأیید نیستند ---
  fake.addSeller(PENDING_USER, "PENDING", "pending-store");
  fake.addSeller(REJECTED_USER, "REJECTED", "rejected-store");
  fake.addSeller(SUSPENDED_USER, "SUSPENDED", "suspended-store");

  app = express();
  app.use(express.json());
  app.use(
    "/api/seller/dashboard",
    createSellerDashboardRouter(
      createSellerDashboardController(createSellerDashboardService(fake.repository)),
    ),
  );
  app.use(errorHandler);
});

describe("GET /api/seller/dashboard — دسترسی", () => {
  it("1) بدون احراز هویت → 401", async () => {
    const res = await request(app).get("/api/seller/dashboard");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("2) مشتری عادی (بدون Seller) → 403", async () => {
    const res = await getDashboard(CUSTOMER, "CUSTOMER");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("AUTHORIZATION_ERROR");
    expect(res.body).not.toHaveProperty("data");
  });

  it("2b) نقش SELLER در توکن بدون رکورد Seller کافی نیست → 403", async () => {
    const res = await getDashboard(CUSTOMER, "SELLER");
    expect(res.status).toBe(403);
  });

  it.each([
    ["3) فروشنده PENDING", PENDING_USER, "در انتظار بررسی"],
    ["4) فروشنده REJECTED", REJECTED_USER, "تأیید نشده"],
    ["5) فروشنده SUSPENDED", SUSPENDED_USER, "تعلیق"],
  ])("%s → 403 با پیام مخصوص و بدون داده", async (_label, userId, fragment) => {
    const res = await getDashboard(userId, "SELLER");
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain(fragment);
    expect(res.body).not.toHaveProperty("data");
  });

  it("6) فروشنده APPROVED → 200 و داشبورد؛ حتی اگر توکن کهنه نقش CUSTOMER داشته باشد", async () => {
    const res = await getDashboard(USER_A, "CUSTOMER");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.seller).toEqual({
      id: sellerA,
      storeName: "فروشگاه الف",
      slug: "store-a",
      status: "APPROVED",
    });
  });

  it("پاسخ Cache نمی‌شود (داده مالی)", async () => {
    const res = await getDashboard(USER_A);
    expect(res.headers["cache-control"]).toBe("no-store");
  });
});

describe("GET /api/seller/dashboard — محاسبات مخصوص همین فروشنده", () => {
  it("8) فروش: فقط سفارش‌های پرداخت‌شده و غیرلغوشده خودِ فروشنده A", async () => {
    const { summary } = (await getDashboard(USER_A)).body.data;
    // 1,000,000 + 500,000 + 2,000,000 + 3,000,000 — بدون لغوشده، پرداخت‌نشده، بازگشتی و بدون فروشنده B
    expect(summary.totalSales).toBe(6_500_000);
  });

  it("8b) فروشنده B مبلغ خودش را می‌بیند، نه مجموع بازار", async () => {
    const { summary } = (await getDashboard(USER_B)).body.data;
    expect(summary.totalSales).toBe(90_000_000);
  });

  it("9) تعداد سفارش‌ها به تفکیک وضعیت موجود در سیستم و فقط برای A", async () => {
    const { summary } = (await getDashboard(USER_A)).body.data;
    expect(summary.totalOrders).toBe(4);
    expect(summary.pendingOrders).toBe(2); // PENDING + PROCESSING
    expect(summary.completedOrders).toBe(1); // DELIVERED
    expect(summary.ordersByStatus).toEqual({
      PENDING: 1,
      PROCESSING: 1,
      SHIPPED: 1,
      DELIVERED: 1,
      CANCELLED: 1,
    });
  });

  it("9b) شمارش سفارش‌های B جداست", async () => {
    const { summary } = (await getDashboard(USER_B)).body.data;
    expect(summary.totalOrders).toBe(2);
    expect(summary.pendingOrders).toBe(1);
    expect(summary.completedOrders).toBe(1);
  });

  it("10) موجودی: فقط Variantهای منتشرشده A (پیش‌نویس/آرشیو و فروشنده B حساب نمی‌شود)", async () => {
    const { summary, inventoryAlerts } = (await getDashboard(USER_A)).body.data;
    expect(summary.lowStockCount).toBe(1);
    expect(summary.outOfStockCount).toBe(1);
    expect(inventoryAlerts.lowStockThreshold).toBe(5);
    expect(inventoryAlerts.lowStock).toHaveLength(1);
    expect(inventoryAlerts.lowStock[0]).toMatchObject({
      productTitle: "کت الف",
      size: "M",
      color: "مشکی",
      stock: 2,
    });
    expect(inventoryAlerts.outOfStock).toHaveLength(1);
    expect(inventoryAlerts.outOfStock[0]).toMatchObject({ productTitle: "کت الف", size: "L", stock: 0 });
  });

  it("10b) موجودی B جداست", async () => {
    const { summary } = (await getDashboard(USER_B)).body.data;
    expect(summary.lowStockCount).toBe(2);
    expect(summary.outOfStockCount).toBe(2);
  });

  it("تعداد محصولات: غیرآرشیو و منتشرشده", async () => {
    const a = (await getDashboard(USER_A)).body.data.summary;
    expect(a.productCount).toBe(2); // منتشرشده + پیش‌نویس
    expect(a.publishedProductCount).toBe(1);
    const b = (await getDashboard(USER_B)).body.data.summary;
    expect(b.productCount).toBe(3);
  });

  it("سفارش‌های اخیر: جدیدترین اول، فقط پرداخت‌شده‌های A، با تعداد اقلام", async () => {
    const { recentOrders } = (await getDashboard(USER_A)).body.data;
    expect(recentOrders.map((o: { orderNumber: number }) => o.orderNumber)).toEqual([
      1005, 1004, 1003, 1002, 1001,
    ]);
    const first = recentOrders[4];
    expect(first).toMatchObject({ orderNumber: 1001, status: "PENDING", total: 1_000_000, itemCount: 3 });
    expect(typeof first.createdAt).toBe("string");
  });

  it("سقف تعداد سفارش‌های اخیر ۵ تاست", async () => {
    for (let i = 0; i < 10; i += 1) {
      fake.addSellerOrder(sellerA, { orderNumber: 3000 + i, subtotal: 1000 });
    }
    const { recentOrders } = (await getDashboard(USER_A)).body.data;
    expect(recentOrders).toHaveLength(5);
  });

  it("فروشنده بدون هیچ سفارش/محصول: صفرها و لیست‌های خالی (نه خطا)", async () => {
    const EMPTY = "77777777-7777-4777-8777-777777777777";
    fake.addSeller(EMPTY, "APPROVED", "empty-store", "فروشگاه خالی");
    const res = await getDashboard(EMPTY);
    expect(res.status).toBe(200);
    expect(res.body.data.summary).toMatchObject({
      totalSales: 0,
      totalOrders: 0,
      pendingOrders: 0,
      completedOrders: 0,
      productCount: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
    });
    expect(res.body.data.recentOrders).toEqual([]);
    expect(res.body.data.inventoryAlerts.lowStock).toEqual([]);
  });
});

describe("GET /api/seller/dashboard — جداسازی داده (Seller A ↔ Seller B)", () => {
  it("7) پاسخ A هیچ اثری از B ندارد (نام، Slug، سفارش، محصول)", async () => {
    const res = await getDashboard(USER_A);
    const body = JSON.stringify(res.body);
    for (const leak of ["فروشگاه ب", "store-b", sellerB, "پیراهن ب", "محصول دیگر ب"]) {
      expect(body).not.toContain(leak);
    }
    expect(body).not.toMatch(/"orderNumber":200[12]/);
  });

  it("7b) پاسخ B هم اثری از A ندارد", async () => {
    const body = JSON.stringify((await getDashboard(USER_B)).body);
    for (const leak of ["فروشگاه الف", "store-a", sellerA, "کت الف"]) {
      expect(body).not.toContain(leak);
    }
  });

  it("?sellerId= در Query هیچ اثری ندارد: همیشه فروشنده خودِ کاربر", async () => {
    const res = await getDashboard(USER_A, "SELLER", `?sellerId=${sellerB}&userId=${USER_B}`);
    expect(res.status).toBe(200);
    expect(res.body.data.seller.id).toBe(sellerA);
    expect(res.body.data.summary.totalSales).toBe(6_500_000);
  });

  it("فروشنده تأییدنشده با ?sellerId= فروشنده تأییدشده هم به داده او نمی‌رسد", async () => {
    const res = await getDashboard(PENDING_USER, "SELLER", `?sellerId=${sellerA}`);
    expect(res.status).toBe(403);
    expect(res.body).not.toHaveProperty("data");
  });

  it("هیچ اطلاعات مشتری (آدرس، تلفن، نام) در پاسخ نیست", async () => {
    const res = await getDashboard(USER_A);
    const order = res.body.data.recentOrders[0];
    expect(Object.keys(order).sort()).toEqual(
      ["createdAt", "id", "itemCount", "orderNumber", "status", "total"].sort(),
    );
    expect(JSON.stringify(res.body)).not.toMatch(/phone|address|fullName|postalCode|userId/i);
  });

  it("فقط GET مجاز است (روش‌های نوشتن این مسیر وجود ندارد)", async () => {
    const res = await request(app)
      .post("/api/seller/dashboard")
      .set("Authorization", tokenFor(USER_A))
      .send({});
    expect(res.status).toBe(404);
  });
});
