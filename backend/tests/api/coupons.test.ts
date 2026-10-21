import express, { type Express } from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../src/middlewares/errorHandler";
import { createRequireAdmin } from "../../src/modules/admin/admin.guard";
import { createAdminCouponsController } from "../../src/modules/coupons/adminCoupons.controller";
import { createAdminCouponsRouter } from "../../src/modules/coupons/adminCoupons.routes";
import { createAdminCouponsService } from "../../src/modules/coupons/adminCoupons.service";
import { createCouponsController } from "../../src/modules/coupons/coupons.controller";
import { createCouponsRouter } from "../../src/modules/coupons/coupons.routes";
import { createCouponsService } from "../../src/modules/coupons/coupons.service";
import { createOrdersController } from "../../src/modules/orders/orders.controller";
import { createCheckoutRouter, createOrdersHistoryRouter } from "../../src/modules/orders/orders.routes";
import { createOrdersService } from "../../src/modules/orders/orders.service";
import { MockPaymentProvider } from "../../src/payment/MockPaymentProvider";
import type { PaymentProvider } from "../../src/payment/PaymentProvider";
import { signAccessToken } from "../../src/utils/tokens";
import { createFakeOrdersRepository } from "../helpers/fakeOrdersRepository";

vi.hoisted(() => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
  process.env.JWT_ACCESS_SECRET ??= "test-access-secret-test-access-secret-1234";
  process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-test-refresh-secret-123";
  process.env.CORS_ORIGIN ??= "http://localhost:3000";
});

const NOW = new Date("2026-10-18T08:00:00.000Z");
const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CUSTOMER = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const USER_C = "33333333-3333-4333-8333-333333333333";
const MISSING = "00000000-0000-4000-8000-999999999999";

let fake: ReturnType<typeof createFakeOrdersRepository>;
let sellerX: string;
let sellerY: string;
let roles: Map<string, "CUSTOMER" | "SELLER" | "ADMIN">;
let clockNow: Date;

const token = (userId: string, role: "CUSTOMER" | "SELLER" | "ADMIN" = "CUSTOMER") => ({
  Authorization: `Bearer ${signAccessToken({ userId, role })}`,
});

function buildApp(provider: PaymentProvider | null = null, repo = fake.repository): Express {
  const app = express();
  app.use(express.json());
  const now = () => clockNow;

  const orders = createOrdersController(createOrdersService(repo, provider, { now }));
  app.use("/api/checkout", createCheckoutRouter(orders));
  app.use("/api/orders", createOrdersHistoryRouter(orders));
  app.use("/api/coupons", createCouponsRouter(createCouponsController(createCouponsService(fake.couponsRepository, { now }))));

  const admin = createAdminCouponsController(createAdminCouponsService(fake.coupons.adminRepository(), { now }));
  const guard = createRequireAdmin(async (userId) => roles.get(userId) ?? null);
  app.use("/api/admin/coupons", createAdminCouponsRouter(admin, guard));
  app.use(errorHandler);
  return app;
}

let app: Express;

beforeEach(() => {
  clockNow = new Date(NOW);
  fake = createFakeOrdersRepository();
  sellerX = fake.addSeller("APPROVED", "فروشگاه X");
  sellerY = fake.addSeller("APPROVED", "فروشگاه Y");
  roles = new Map([
    [ADMIN, "ADMIN"],
    [CUSTOMER, "CUSTOMER"],
    [USER_B, "CUSTOMER"],
    [USER_C, "CUSTOMER"],
  ]);
  app = buildApp(null);
});

/** کاربر با آدرس و سبدی از [variantId, qty]ها */
function shopper(userId: string, lines: [string, number][]) {
  const addressId = fake.addAddress(userId);
  for (const [variantId, qty] of lines) fake.addToCart(userId, variantId, qty);
  return addressId;
}

const checkout = (userId: string, addressId: string, extra: Record<string, unknown> = {}, application = app) =>
  request(application)
    .post("/api/checkout")
    .set(token(userId))
    .send({ addressId, checkoutKey: randomUUID(), ...extra });

const validateCode = (userId: string, code: unknown, application = app) =>
  request(application).post("/api/coupons/validate").set(token(userId)).send({ code });

const validPayload = (over: Record<string, unknown> = {}) => ({
  code: "SUMMER10",
  discountType: "PERCENTAGE",
  discountValue: 10,
  ...over,
});

// ───────────────────────────── دسترسی ادمین ─────────────────────────────
describe("دسترسی ادمین", () => {
  const endpoints: [string, string][] = [
    ["get", "/api/admin/coupons"],
    ["post", "/api/admin/coupons"],
    ["get", `/api/admin/coupons/${MISSING}`],
    ["patch", `/api/admin/coupons/${MISSING}`],
    ["patch", `/api/admin/coupons/${MISSING}/status`],
  ];

  it("1) بدون توکن → 401 روی همهٔ مسیرها", async () => {
    for (const [method, path] of endpoints) {
      const res = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[method]!(path).send({});
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });

  it("2) مشتری/فروشنده → 403 حتی با بدنهٔ نامعتبر (قبل از اعتبارسنجی) و بدون هیچ اثر", async () => {
    roles.set(CUSTOMER, "CUSTOMER");
    for (const [method, path] of endpoints) {
      const res = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[method]!(path)
        .set(token(CUSTOMER, "CUSTOMER"))
        .send({ bogus: true });
      expect(res.status, `${method} ${path}`).toBe(403);
    }
    expect(fake.coupons.coupons.size).toBe(0);
  });

  it("3) نقش داخل توکن نادیده گرفته می‌شود: توکن ادعای ADMIN ولی نقش DB مشتری → 403؛ ادمین عزل‌شده → 403", async () => {
    expect((await request(app).get("/api/admin/coupons").set(token(CUSTOMER, "ADMIN"))).status).toBe(403);
    roles.set(ADMIN, "CUSTOMER");
    expect((await request(app).get("/api/admin/coupons").set(token(ADMIN, "ADMIN"))).status).toBe(403);
  });
});

// ───────────────────────────── ساخت و ویرایش ─────────────────────────────
describe("ساخت کوپن (ادمین)", () => {
  const create = (body: Record<string, unknown>) =>
    request(app).post("/api/admin/coupons").set(token(ADMIN, "ADMIN")).send(body);

  it("4) ساخت موفق: کد نرمال می‌شود (ارقام فارسی/حروف کوچک)، پیش‌فرض‌ها، ممیزی با هویت ادمین از توکن", async () => {
    const res = await create(validPayload({ code: " summer۱۰ " }));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      code: "SUMMER10",
      discountType: "PERCENTAGE",
      discountValue: 10,
      isActive: true,
      state: "ACTIVE",
      usedCount: 0,
      productCount: 0,
      categoryCount: 0,
    });
    expect(fake.coupons.audits).toHaveLength(1);
    expect(fake.coupons.audits[0]).toMatchObject({ adminId: ADMIN, action: "COUPON_CREATED", targetType: "COUPON" });
  });

  it("5) فیلدهای ناشناخته/خطرناک (usedCount، actorId) → 400 (strict) و چیزی ساخته نمی‌شود", async () => {
    for (const extra of [{ usedCount: 5 }, { actorId: ADMIN }, { id: MISSING }]) {
      const res = await create(validPayload(extra));
      expect(res.status).toBe(400);
    }
    expect(fake.coupons.coupons.size).toBe(0);
  });

  it("6) کد تکراری (حتی با حروف/ارقام متفاوت) → 409 و ساخت دوم انجام نمی‌شود", async () => {
    expect((await create(validPayload())).status).toBe(201);
    for (const code of ["SUMMER10", "summer10", "SUMMER۱۰"]) {
      const res = await create(validPayload({ code }));
      expect(res.status).toBe(409);
      expect(res.body.error.details.code).toBeDefined();
    }
    expect(fake.coupons.coupons.size).toBe(1);
  });

  it("7) اعتبارسنجی: درصد خارج از ۱..۱۰۰، مبلغ منفی/صفر/اعشاری/خیلی بزرگ، کد نامعتبر", async () => {
    const bad: Record<string, unknown>[] = [
      { discountValue: 101 },
      { discountValue: 0 },
      { discountValue: -5 },
      { discountType: "FIXED", discountValue: 1.5 },
      { discountType: "FIXED", discountValue: 2_000_000_000 },
      { discountType: "FIXED", discountValue: 50_000, maxDiscountAmount: 10_000 },
      { maxDiscountAmount: 0 },
      { minPurchaseAmount: -1 },
      { code: "ab" },
      { code: "a b!" },
      { code: "تخفیف" },
      { discountType: "BOGO" },
      { usageLimit: 0 },
      { perUserLimit: 0 },
      { usageLimit: 5, perUserLimit: 6 },
      { startsAt: "not-a-date" },
    ];
    for (const patch of bad) {
      const res = await create(validPayload(patch));
      expect(res.status, JSON.stringify(patch)).toBe(400);
    }
    expect(fake.coupons.coupons.size).toBe(0);
  });

  it("8) بازهٔ تاریخ: پایان ≤ شروع رد می‌شود؛ بازهٔ درست پذیرفته و وضعیت مشتق‌شده درست است", async () => {
    expect(
      (await create(validPayload({ startsAt: "2026-11-02T00:00:00.000Z", expiresAt: "2026-11-01T00:00:00.000Z" }))).status,
    ).toBe(400);
    expect(
      (await create(validPayload({ startsAt: "2026-11-01T00:00:00.000Z", expiresAt: "2026-11-01T00:00:00.000Z" }))).status,
    ).toBe(400);
    const future = await create(validPayload({ code: "FUTURE", startsAt: "2026-11-01T00:00:00.000Z", expiresAt: "2026-12-01T00:00:00.000Z" }));
    expect(future.status).toBe(201);
    expect(future.body.data.state).toBe("SCHEDULED");
    const past = await create(validPayload({ code: "OLDONE", expiresAt: "2026-10-01T00:00:00.000Z" }));
    expect(past.body.data.state).toBe("EXPIRED");
  });

  it("9) محدودیت‌ها از روابط DB سنجیده می‌شوند: فروشنده/محصول/دسته ناموجود، یا محصول فروشندهٔ دیگر → 400", async () => {
    const productX = fake.addVariant({ sellerId: sellerX, stock: 5 });
    const pidX = [...fake.coupons.lookups.products.entries()].find(([, p]) => p.sellerId === sellerX)![0];
    void productX;
    const category = fake.addCategory();

    expect((await create(validPayload({ code: "NOSELLER", sellerId: MISSING }))).status).toBe(400);
    expect((await create(validPayload({ code: "NOPROD", productIds: [MISSING] }))).status).toBe(400);
    expect((await create(validPayload({ code: "NOCAT", categoryIds: [MISSING] }))).status).toBe(400);
    const crossSeller = await create(validPayload({ code: "CROSS", sellerId: sellerY, productIds: [pidX] }));
    expect(crossSeller.status).toBe(400);
    expect(crossSeller.body.error.details.productIds).toBeDefined();

    const ok = await create(
      validPayload({ code: "SCOPED", sellerId: sellerX, productIds: [pidX, pidX], categoryIds: [category] }),
    );
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ sellerId: sellerX, sellerName: "فروشگاه X", productCount: 1, categoryCount: 1 });
    expect(ok.body.data.products).toHaveLength(1);
  });
});

describe("فهرست، جزئیات و ویرایش", () => {
  const asAdmin = () => token(ADMIN, "ADMIN");

  it("10) فهرست: صفحه‌بندی، جستجوی کد (نرمال‌شده)، فیلتر وضعیت، جدیدترین اول", async () => {
    for (const code of ["AAA111", "BBB222", "AAB333", "CCC444"]) {
      await request(app).post("/api/admin/coupons").set(asAdmin()).send(validPayload({ code }));
    }
    const all = await request(app).get("/api/admin/coupons?limit=2&page=1").set(asAdmin());
    expect(all.status).toBe(200);
    expect(all.body.data.pagination).toEqual({ page: 1, limit: 2, total: 4, totalPages: 2 });
    expect(all.body.data.data.map((c: { code: string }) => c.code)).toEqual(["CCC444", "AAB333"]);

    const search = await request(app).get("/api/admin/coupons?q=aa").set(asAdmin());
    expect(search.body.data.data.map((c: { code: string }) => c.code).sort()).toEqual(["AAA111", "AAB333"]);
    const digits = await request(app).get(`/api/admin/coupons?q=${encodeURIComponent("۲۲۲")}`).set(asAdmin());
    expect(digits.body.data.data.map((c: { code: string }) => c.code)).toEqual(["BBB222"]);

    const first = (await request(app).get("/api/admin/coupons").set(asAdmin())).body.data.data[0];
    await request(app).patch(`/api/admin/coupons/${first.id}/status`).set(asAdmin()).send({ isActive: false });
    const inactive = await request(app).get("/api/admin/coupons?isActive=false").set(asAdmin());
    expect(inactive.body.data.pagination.total).toBe(1);
    expect((await request(app).get("/api/admin/coupons?limit=500").set(asAdmin())).status).toBe(400);
  });

  it("11) جزئیات: آمار فقط از داده‌های واقعی؛ ناموجود → 404؛ شناسهٔ نامعتبر → 400", async () => {
    const c = fake.coupons.seed({ code: "STATS1", discountValue: 100_000, usageLimit: 10 });
    const variant = fake.addVariant({ sellerId: sellerX, stock: 5, basePrice: 1_000_000 });
    const address = shopper(CUSTOMER, [[variant, 1]]);
    expect((await checkout(CUSTOMER, address, { couponCode: "STATS1" })).status).toBe(201);

    const res = await request(app).get(`/api/admin/coupons/${c.id}`).set(asAdmin());
    expect(res.status).toBe(200);
    expect(res.body.data.stats).toEqual({ usedCount: 1, releasedCount: 0, remaining: 9, totalDiscountAmount: 100_000 });
    expect((await request(app).get(`/api/admin/coupons/${MISSING}`).set(asAdmin())).status).toBe(404);
    expect((await request(app).get("/api/admin/coupons/not-a-uuid").set(asAdmin())).status).toBe(400);
  });

  it("12) ویرایش: کد تغییرناپذیر و فیلد ناشناخته رد می‌شود؛ بدنهٔ خالی 400؛ ناموجود 404", async () => {
    const c = fake.coupons.seed({ code: "EDIT01" });
    const patch = (body: Record<string, unknown>, id = c.id) =>
      request(app).patch(`/api/admin/coupons/${id}`).set(asAdmin()).send(body);
    expect((await patch({ code: "OTHER99" })).status).toBe(400);
    expect((await patch({ usedCount: 0 })).status).toBe(400);
    expect((await patch({})).status).toBe(400);
    expect((await patch({ discountValue: 5 }, MISSING)).status).toBe(404);
    expect(fake.coupons.get(c.id).code).toBe("EDIT01");
  });

  it("13) ویرایش: قوانین روی «حالت ادغام‌شده» سنجیده می‌شود (تغییر نوع به ثابت با سقف تخفیف قبلی رد می‌شود)", async () => {
    const c = fake.coupons.seed({
      code: "MERGE1",
      discountType: "PERCENTAGE",
      discountValue: 20,
      maxDiscountAmount: 50_000,
    });
    const bad = await request(app)
      .patch(`/api/admin/coupons/${c.id}`)
      .set(asAdmin())
      .send({ discountType: "FIXED", discountValue: 30_000 });
    expect(bad.status).toBe(400);
    expect(bad.body.error.details.maxDiscountAmount).toBeDefined();
    expect(fake.coupons.get(c.id).discountType).toBe("PERCENTAGE");

    const ok = await request(app)
      .patch(`/api/admin/coupons/${c.id}`)
      .set(asAdmin())
      .send({ discountType: "FIXED", discountValue: 30_000, maxDiscountAmount: null });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ discountType: "FIXED", discountValue: 30_000, maxDiscountAmount: null });
    expect(fake.coupons.audits.at(-1)).toMatchObject({ action: "COUPON_UPDATED", adminId: ADMIN });
  });

  it("14) کاهش سقف کل به کمتر از «استفاده‌شده» → 409؛ برابر یا بیشتر مجاز", async () => {
    const c = fake.coupons.seed({ code: "LIMIT1", usageLimit: 10, usedCount: 4 });
    const patch = (usageLimit: number) =>
      request(app).patch(`/api/admin/coupons/${c.id}`).set(asAdmin()).send({ usageLimit });
    expect((await patch(3)).status).toBe(409);
    expect(fake.coupons.get(c.id).usageLimit).toBe(10);
    expect((await patch(4)).status).toBe(200);
  });

  it("15) فعال/غیرفعال: ممیزی با وضعیت قبل/بعد؛ تکرار همان وضعیت Idempotent و بدون ممیزی اضافه", async () => {
    const c = fake.coupons.seed({ code: "TOGGLE1" });
    const set = (isActive: unknown) =>
      request(app).patch(`/api/admin/coupons/${c.id}/status`).set(asAdmin()).send({ isActive });
    const off = await set(false);
    expect(off.status).toBe(200);
    expect(off.body.data).toMatchObject({ isActive: false, state: "INACTIVE" });
    expect((await set(false)).status).toBe(200);
    expect(fake.coupons.audits.filter((a) => a.action === "COUPON_STATUS_CHANGED")).toHaveLength(1);
    expect(fake.coupons.audits[0]).toMatchObject({ fromStatus: "ACTIVE", toStatus: "INACTIVE", adminId: ADMIN });
    expect((await set("yes")).status).toBe(400);
    expect((await set(true)).body.data.state).toBe("ACTIVE");
    expect((await request(app).patch(`/api/admin/coupons/${MISSING}/status`).set(asAdmin()).send({ isActive: true })).status).toBe(404);
  });
});

// ───────────────────────────── پیش‌نمایش (validate) ─────────────────────────────
describe("اعتبارسنجی کوپن روی سبد (پیش‌نمایش)", () => {
  let variantX: string;
  let variantY: string;

  beforeEach(() => {
    variantX = fake.addVariant({ sellerId: sellerX, stock: 10, basePrice: 1_000_000 });
    variantY = fake.addVariant({ sellerId: sellerY, stock: 10, basePrice: 500_000 });
    shopper(CUSTOMER, [
      [variantX, 2],
      [variantY, 1],
    ]); // subtotal = 2_500_000
  });

  it("16) بدون توکن 401؛ بدنهٔ نامعتبر/فیلد اضافی (مبلغ دستی) 400", async () => {
    expect((await request(app).post("/api/coupons/validate").send({ code: "A" })).status).toBe(401);
    expect((await validateCode(CUSTOMER, "")).status).toBe(400);
    expect((await validateCode(CUSTOMER, 123)).status).toBe(400);
    const extra = await request(app)
      .post("/api/coupons/validate")
      .set(token(CUSTOMER))
      .send({ code: "SAVE", discountAmount: 9_999_999, cartTotal: 1 });
    expect(extra.status).toBe(400);
  });

  it("17) درصدی با سقف: همهٔ مبالغ از سرور؛ پیش‌نمایش «مصرف» نیست (usedCount و استفاده‌ها ثابت)", async () => {
    const c = fake.coupons.seed({
      code: "PCT20",
      discountType: "PERCENTAGE",
      discountValue: 20,
      maxDiscountAmount: 400_000,
      usageLimit: 5,
    });
    const res = await validateCode(CUSTOMER, " pct20 ");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      code: "PCT20",
      description: null,
      discountType: "PERCENTAGE",
      discountValue: 20,
      eligibleSubtotal: 2_500_000,
      subtotal: 2_500_000,
      discountAmount: 400_000, // ۲۰٪ = ۵۰۰٬۰۰۰ ولی سقف ۴۰۰٬۰۰۰
      shippingCost: 0,
      totalAmount: 2_100_000,
      appliesToAllItems: true,
    });
    for (let i = 0; i < 3; i += 1) await validateCode(CUSTOMER, "PCT20");
    expect(fake.coupons.get(c.id).usedCount).toBe(0);
    expect(fake.coupons.redemptions).toHaveLength(0);
  });

  it("18) کوپن ثابت بزرگ‌تر از مبلغ مشمول: تخفیف = مبلغ مشمول و جمع هرگز منفی نمی‌شود", async () => {
    fake.coupons.seed({ code: "HUGE", discountValue: 900_000_000 });
    const res = await validateCode(CUSTOMER, "HUGE");
    expect(res.body.data.discountAmount).toBe(2_500_000);
    expect(res.body.data.totalAmount).toBe(0);
  });

  it("19) پیام‌ها و کدهای خطا برای هر قانون (HTTP 422، کد COUPON_*)", async () => {
    const day = 86_400_000;
    fake.coupons.seed({ code: "OFFLINE", isActive: false });
    fake.coupons.seed({ code: "EXPIRED1", expiresAt: new Date(NOW.getTime() - day) });
    fake.coupons.seed({ code: "SOON", startsAt: new Date(NOW.getTime() + day) });
    fake.coupons.seed({ code: "FULL", usageLimit: 3, usedCount: 3 });
    fake.coupons.seed({ code: "MINBIG", minPurchaseAmount: 10_000_000 });
    fake.coupons.seed({ code: "OTHERSELLER", sellerId: randomUUID() });

    const expectations: [string, string][] = [
      ["NOPE123", "COUPON_INVALID"],
      ["OFFLINE", "COUPON_INVALID"],
      ["EXPIRED1", "COUPON_EXPIRED"],
      ["SOON", "COUPON_NOT_STARTED"],
      ["FULL", "COUPON_USAGE_LIMIT_REACHED"],
      ["MINBIG", "COUPON_MIN_PURCHASE_NOT_MET"],
      ["OTHERSELLER", "COUPON_NOT_APPLICABLE"],
      ["x", "COUPON_INVALID"],
      ["تخفیف!!", "COUPON_INVALID"],
    ];
    for (const [code, expected] of expectations) {
      const res = await validateCode(CUSTOMER, code);
      expect(res.status, code).toBe(422);
      expect(res.body.error.code, code).toBe(expected);
      expect(typeof res.body.error.message).toBe("string");
    }
    // غیرفعال و ناموجود پیام یکسان دارند (وضعیت داخلی کدها فاش نمی‌شود)
    const a = await validateCode(CUSTOMER, "OFFLINE");
    const b = await validateCode(CUSTOMER, "NOPE123");
    expect(a.body.error.message).toBe(b.body.error.message);
    const min = await validateCode(CUSTOMER, "MINBIG");
    expect(min.body.error.details).toEqual({ minPurchaseAmount: ["10000000"], eligibleSubtotal: ["2500000"] });
  });

  it("20) سقف هر مشتری فقط استفادهٔ «فعال» همان مشتری را می‌شمارد", async () => {
    const c = fake.coupons.seed({ code: "ONCE", perUserLimit: 1, usageLimit: 10 });
    fake.coupons.redemptions.push({
      id: randomUUID(),
      couponId: c.id,
      userId: USER_B,
      orderId: randomUUID(),
      discountAmount: 1,
      status: "ACTIVE",
      releasedAt: null,
    });
    expect((await validateCode(CUSTOMER, "ONCE")).status).toBe(200); // استفادهٔ کاربر دیگر مربوط نیست
    fake.coupons.redemptions.push({
      id: randomUUID(),
      couponId: c.id,
      userId: CUSTOMER,
      orderId: randomUUID(),
      discountAmount: 1,
      status: "RELEASED",
      releasedAt: new Date(),
    });
    expect((await validateCode(CUSTOMER, "ONCE")).status).toBe(200); // آزادشده حساب نمی‌شود
    fake.coupons.redemptions.push({
      id: randomUUID(),
      couponId: c.id,
      userId: CUSTOMER,
      orderId: randomUUID(),
      discountAmount: 1,
      status: "ACTIVE",
      releasedAt: null,
    });
    const res = await validateCode(CUSTOMER, "ONCE");
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("COUPON_USER_LIMIT_REACHED");
  });

  it("21) کوپن فروشنده فقط کالای او را تخفیف می‌دهد (appliesToAllItems=false)؛ محدودیت محصول و دستهٔ والد", async () => {
    fake.coupons.seed({ code: "ONLYX", sellerId: sellerX, discountType: "PERCENTAGE", discountValue: 10 });
    const res = await validateCode(CUSTOMER, "ONLYX");
    expect(res.body.data).toMatchObject({
      eligibleSubtotal: 2_000_000,
      subtotal: 2_500_000,
      discountAmount: 200_000,
      totalAmount: 2_300_000,
      appliesToAllItems: false,
    });

    const parent = fake.addCategory(null, "زنانه");
    const child = fake.addCategory(parent, "کت");
    const coat = fake.addVariant({ sellerId: sellerX, stock: 5, basePrice: 800_000, categoryId: child });
    shopper(USER_B, [
      [coat, 1],
      [variantY, 1],
    ]);
    fake.coupons.seed({ code: "WOMEN", categoryIds: [parent], discountValue: 50_000 });
    const byParent = await validateCode(USER_B, "WOMEN");
    expect(byParent.body.data).toMatchObject({ eligibleSubtotal: 800_000, discountAmount: 50_000 });
  });

  it("22) سبد خالی → COUPON_EMPTY_CART؛ کالای ناموجود/تعلیق‌شده تخفیف نمی‌گیرد", async () => {
    fake.coupons.seed({ code: "ANY123", discountType: "PERCENTAGE", discountValue: 10 });
    expect((await validateCode(USER_C, "ANY123")).body.error.code).toBe("COUPON_EMPTY_CART");
    fake.setSellerStatus(sellerY, "SUSPENDED");
    const res = await validateCode(CUSTOMER, "ANY123");
    expect(res.body.data.subtotal).toBe(2_000_000); // کالای فروشندهٔ تعلیق‌شده حذف شد
    expect(res.body.data.discountAmount).toBe(200_000);
  });

  it("23) بعد از تغییر سبد نتیجه دوباره محاسبه می‌شود (بدون Cache)", async () => {
    fake.coupons.seed({ code: "SAVE5", discountType: "PERCENTAGE", discountValue: 5 });
    expect((await validateCode(CUSTOMER, "SAVE5")).body.data.discountAmount).toBe(125_000);
    fake.addToCart(CUSTOMER, fake.addVariant({ sellerId: sellerX, stock: 3, basePrice: 1_000_000 }), 1);
    const after = await validateCode(CUSTOMER, "SAVE5");
    expect(after.body.data).toMatchObject({ subtotal: 3_500_000, discountAmount: 175_000 });
  });
});

// ───────────────────────────── Checkout ─────────────────────────────
describe("Checkout با کوپن", () => {
  let vx: string;
  let vy: string;
  let address: string;

  beforeEach(() => {
    vx = fake.addVariant({ sellerId: sellerX, stock: 10, basePrice: 1_000_000 });
    vy = fake.addVariant({ sellerId: sellerY, stock: 10, basePrice: 500_000 });
    address = shopper(CUSTOMER, [
      [vx, 2],
      [vy, 1],
    ]); // 2_500_000
  });

  it("24) سفارش با کوپن: جمع‌ها از سرور، Snapshot کد، سهم‌ها با هم و با سفارش والد یکی، مصرف ثبت می‌شود", async () => {
    const c = fake.coupons.seed({ code: "PCT10", discountType: "PERCENTAGE", discountValue: 10, usageLimit: 3 });
    const res = await checkout(CUSTOMER, address, { couponCode: "pct10" });
    expect(res.status).toBe(201);
    const order = res.body.data;
    expect(order).toMatchObject({
      subtotal: 2_500_000,
      discountAmount: 250_000,
      totalAmount: 2_250_000,
      couponCode: "PCT10",
      status: "PENDING",
    });
    const sellerDiscounts = order.sellerOrders.map((so: { discountAmount: number }) => so.discountAmount);
    expect(sellerDiscounts.reduce((s: number, v: number) => s + v, 0)).toBe(250_000);
    expect(order.sellerOrders.reduce((s: number, so: { subtotal: number }) => s + so.subtotal, 0)).toBe(order.subtotal);
    const row = fake.orders[0]!;
    const itemSum = row.sellerOrders.flatMap((so) => so.items).reduce((s, i) => s + i.discountAmount, 0);
    expect(itemSum).toBe(250_000);
    expect(fake.coupons.get(c.id).usedCount).toBe(1);
    expect(fake.coupons.redemptions).toEqual([
      expect.objectContaining({ couponId: c.id, userId: CUSTOMER, orderId: order.id, discountAmount: 250_000, status: "ACTIVE" }),
    ]);
  });

  it("25) فقط کد پذیرفته می‌شود: مبلغ/تخفیف/فروشنده ارسالی Client نادیده یا رد می‌شود", async () => {
    fake.coupons.seed({ code: "FIX100", discountValue: 100_000 });
    const res = await checkout(CUSTOMER, address, {
      couponCode: "FIX100",
      discountAmount: 2_400_000,
      totalAmount: 1,
      couponId: randomUUID(),
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ discountAmount: 100_000, totalAmount: 2_400_000 });
  });

  it("26) کوپن فروشنده: فقط سهم همان فروشنده تخفیف می‌گیرد؛ فروشندهٔ دیگر صفر", async () => {
    fake.coupons.seed({ code: "SELLERX", sellerId: sellerX, discountType: "PERCENTAGE", discountValue: 25 });
    const res = await checkout(CUSTOMER, address, { couponCode: "SELLERX" });
    expect(res.status).toBe(201);
    const byStore = Object.fromEntries(
      res.body.data.sellerOrders.map((so: { sellerStoreName: string; discountAmount: number }) => [so.sellerStoreName, so.discountAmount]),
    );
    expect(byStore).toEqual({ "فروشگاه X": 500_000, "فروشگاه Y": 0 });
    expect(res.body.data.discountAmount).toBe(500_000);
  });

  it("27) کوپن نامعتبر/منقضی/غیرفعال در Checkout → 422 و هیچ اثری (موجودی، سبد، سفارش، مصرف)", async () => {
    fake.coupons.seed({ code: "DEAD", expiresAt: new Date(NOW.getTime() - 1000) });
    fake.coupons.seed({ code: "OFF", isActive: false });
    for (const code of ["DEAD", "OFF", "GHOST1"]) {
      const res = await checkout(CUSTOMER, address, { couponCode: code });
      expect(res.status, code).toBe(422);
    }
    expect(fake.orders).toHaveLength(0);
    expect(fake.stock(vx)).toBe(10);
    expect(fake.cart(CUSTOMER)).toHaveLength(2);
    expect(fake.coupons.redemptions).toHaveLength(0);
  });

  it("28) بازبینی هنگام Checkout: کوپنی که بین پیش‌نمایش و ثبت منقضی/غیرفعال شد، سفارش نمی‌سازد", async () => {
    const c = fake.coupons.seed({ code: "FLIP", discountValue: 50_000 });
    expect((await validateCode(CUSTOMER, "FLIP")).status).toBe(200);
    clockNow = new Date(NOW.getTime() + 1000);
    c.expiresAt = new Date(NOW.getTime() + 500);
    expect((await checkout(CUSTOMER, address, { couponCode: "FLIP" })).body.error.code).toBe("COUPON_EXPIRED");
    c.expiresAt = null;
    c.isActive = false;
    expect((await checkout(CUSTOMER, address, { couponCode: "FLIP" })).body.error.code).toBe("COUPON_INVALID");
    expect(fake.orders).toHaveLength(0);
  });

  it("29) expectedTotal شامل تخفیف است؛ مبلغ بدون تخفیف → 409 PRICE_CHANGED و کوپن مصرف نمی‌شود", async () => {
    const c = fake.coupons.seed({ code: "SAVE200", discountValue: 200_000 });
    const stale = await checkout(CUSTOMER, address, { couponCode: "SAVE200", expectedTotal: 2_500_000 });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("CHECKOUT_PRICE_CHANGED");
    expect(stale.body.error.details.actualTotal).toEqual(["2300000"]);
    expect(fake.coupons.get(c.id).usedCount).toBe(0);
    const ok = await checkout(CUSTOMER, address, { couponCode: "SAVE200", expectedTotal: 2_300_000 });
    expect(ok.status).toBe(201);
  });

  it("30) کوپن بزرگ: جمع صفر (نه منفی)؛ سفارش بدون Provider پرداخت‌شده نمی‌شود", async () => {
    fake.coupons.seed({ code: "FREE", discountValue: 900_000_000 });
    const res = await checkout(CUSTOMER, address, { couponCode: "FREE" });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ discountAmount: 2_500_000, totalAmount: 0, status: "PENDING", paidAt: null });
  });

  it("31) کوپن «پرداخت» را تأیید نمی‌کند: فقط Provider تزریق‌شده PAID می‌کند", async () => {
    fake.coupons.seed({ code: "PAYTEST", discountValue: 100_000 });
    const none = await checkout(CUSTOMER, address, { couponCode: "PAYTEST" });
    expect(none.body.data.status).toBe("PENDING");
    const failing: PaymentProvider = {
      createPaymentSession: async () => ({ providerRef: "x", redirectUrl: "u" }),
      verifyPayment: async () => ({ success: false }),
    } as unknown as PaymentProvider;
    fake.addToCart(USER_B, vx, 1);
    const addrB = fake.addAddress(USER_B);
    fake.coupons.seed({ code: "PAYTEST2", discountValue: 100_000 });
    const withFailing = await checkout(USER_B, addrB, { couponCode: "PAYTEST2" }, buildApp(failing));
    expect(withFailing.body.data.status).toBe("PENDING");
    fake.addToCart(USER_C, vx, 1);
    const addrC = fake.addAddress(USER_C);
    fake.coupons.seed({ code: "PAYTEST3", discountValue: 100_000 });
    const withMock = await checkout(USER_C, addrC, { couponCode: "PAYTEST3" }, buildApp(new MockPaymentProvider()));
    expect(withMock.body.data.status).toBe("PAID");
    expect(withMock.body.data.totalAmount).toBe(900_000);
  });

  it("32) Snapshot تاریخی: بعد از ویرایش/غیرفعال‌سازی کوپن، مبالغ و کد سفارش قبلی ثابت می‌ماند", async () => {
    const c = fake.coupons.seed({ code: "SNAP", discountType: "PERCENTAGE", discountValue: 10 });
    const placed = await checkout(CUSTOMER, address, { couponCode: "SNAP" });
    const orderId = placed.body.data.id;
    c.discountValue = 90;
    c.isActive = false;
    c.code = "RENAMED";
    const again = await request(app).get(`/api/orders/${orderId}`).set(token(CUSTOMER));
    expect(again.body.data).toMatchObject({ couponCode: "SNAP", discountAmount: 250_000, totalAmount: 2_250_000 });
  });
});

describe("سقف استفاده و همزمانی", () => {
  let vx: string;
  beforeEach(() => {
    vx = fake.addVariant({ sellerId: sellerX, stock: 50, basePrice: 1_000_000 });
  });

  it("33) آخرین ظرفیت: ۸ مشتری مختلف همزمان → دقیقاً یک موفقیت؛ usedCount هرگز از سقف نمی‌گذرد", async () => {
    const c = fake.coupons.seed({ code: "LAST1", usageLimit: 1, discountValue: 100_000 });
    const users = Array.from({ length: 8 }, () => randomUUID());
    const attempts = users.map((userId) => {
      const addressId = shopper(userId, [[vx, 1]]);
      return checkout(userId, addressId, { couponCode: "LAST1" });
    });
    const results = await Promise.all(attempts);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    const failures = results.filter((r) => r.status !== 201);
    expect(failures).toHaveLength(7);
    for (const f of failures) expect(f.body.error.code).toBe("COUPON_USAGE_LIMIT_REACHED");
    expect(fake.coupons.get(c.id).usedCount).toBe(1);
    expect(fake.coupons.activeRedemptions(c.id)).toHaveLength(1);
    expect(fake.orders).toHaveLength(1);
    expect(fake.stock(vx)).toBe(49); // سفارش‌های ردشده موجودی را نگرفتند
  });

  it("34) سقف ۳ و ۱۰ درخواست همزمان → دقیقاً ۳ سفارش", async () => {
    const c = fake.coupons.seed({ code: "THREE", usageLimit: 3 });
    const results = await Promise.all(
      Array.from({ length: 10 }, () => {
        const userId = randomUUID();
        return checkout(userId, shopper(userId, [[vx, 1]]), { couponCode: "THREE" });
      }),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(fake.coupons.get(c.id).usedCount).toBe(3);
  });

  it("35) سقف هر مشتری: یک مشتری با ۵ کلید متفاوت همزمان → فقط یکی؛ مشتری دیگر مستقل است", async () => {
    const c = fake.coupons.seed({ code: "SOLO", perUserLimit: 1 });
    const addressId = fake.addAddress(CUSTOMER);
    for (let i = 0; i < 5; i += 1) fake.addToCart(CUSTOMER, fake.addVariant({ sellerId: sellerX, stock: 5 }), 1);
    const burst = await Promise.all(
      Array.from({ length: 5 }, () => checkout(CUSTOMER, addressId, { couponCode: "SOLO" })),
    );
    expect(burst.filter((r) => r.status === 201)).toHaveLength(1);
    expect(fake.coupons.activeRedemptions(c.id).filter((r) => r.userId === CUSTOMER)).toHaveLength(1);

    const other = shopper(USER_B, [[vx, 1]]);
    expect((await checkout(USER_B, other, { couponCode: "SOLO" })).status).toBe(201);
    // مشتری اول دوباره
    fake.addToCart(CUSTOMER, vx, 1);
    const again = await checkout(CUSTOMER, addressId, { couponCode: "SOLO" });
    expect(again.status).toBe(422);
    expect(again.body.error.code).toBe("COUPON_USER_LIMIT_REACHED");
  });

  it("36) ارسال تکراری با همان checkoutKey (۶ درخواست موازی) → یک سفارش، یک مصرف", async () => {
    const c = fake.coupons.seed({ code: "IDEMP", usageLimit: 5, discountValue: 100_000 });
    const addressId = shopper(CUSTOMER, [[vx, 2]]);
    const key = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        request(app).post("/api/checkout").set(token(CUSTOMER)).send({ addressId, checkoutKey: key, couponCode: "IDEMP" }),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 200)).toHaveLength(5);
    expect(new Set(results.map((r) => r.body.data.id)).size).toBe(1);
    expect(fake.coupons.get(c.id).usedCount).toBe(1);
    expect(fake.coupons.redemptions).toHaveLength(1);
    expect(fake.stock(vx)).toBe(48);
  });

  it("37) تلاش مجدد با همان کلید بعد از موفقیت (حتی اگر کوپن بعداً تمام شود) همان سفارش را می‌دهد و دوباره مصرف نمی‌کند", async () => {
    const c = fake.coupons.seed({ code: "RETRY", usageLimit: 1 });
    const addressId = shopper(CUSTOMER, [[vx, 1]]);
    const key = randomUUID();
    const first = await request(app).post("/api/checkout").set(token(CUSTOMER)).send({ addressId, checkoutKey: key, couponCode: "RETRY" });
    expect(first.status).toBe(201);
    const second = await request(app).post("/api/checkout").set(token(CUSTOMER)).send({ addressId, checkoutKey: key, couponCode: "RETRY" });
    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(fake.coupons.get(c.id).usedCount).toBe(1);
  });
});

describe("اتمیک بودن (Rollback)", () => {
  let vx: string;
  let address: string;
  beforeEach(() => {
    vx = fake.addVariant({ sellerId: sellerX, stock: 5, basePrice: 1_000_000 });
    address = shopper(CUSTOMER, [[vx, 2]]);
  });

  for (const [title, fault] of [
    ["ساخت سفارش", "failOnCreateOrder"],
    ["ثبت مصرف کوپن", "failOnCreateRedemption"],
    ["ثبت حرکت انبار", "failOnRecordMovements"],
  ] as const) {
    it(`38) شکست در ${title} → Rollback کامل: usedCount، استفاده‌ها، موجودی، سبد و سفارش برنمی‌گردند نیمه‌کاره`, async () => {
      const c = fake.coupons.seed({ code: "ATOMIC", usageLimit: 2, discountValue: 100_000 });
      fake.faults[fault] = true;
      const failed = await checkout(CUSTOMER, address, { couponCode: "ATOMIC" });
      expect(failed.status).toBe(500);
      expect(fake.coupons.get(c.id).usedCount).toBe(0);
      expect(fake.coupons.redemptions).toHaveLength(0);
      expect(fake.orders).toHaveLength(0);
      expect(fake.stock(vx)).toBe(5);
      expect(fake.cart(CUSTOMER)).toHaveLength(1);

      fake.faults[fault] = false;
      const retry = await checkout(CUSTOMER, address, { couponCode: "ATOMIC" });
      expect(retry.status).toBe(201);
      expect(fake.coupons.get(c.id).usedCount).toBe(1);
    });
  }
});

describe("لغو سفارش و استفادهٔ کوپن", () => {
  let vx: string;
  let address: string;
  let couponId: string;
  beforeEach(() => {
    vx = fake.addVariant({ sellerId: sellerX, stock: 10, basePrice: 1_000_000 });
    address = shopper(CUSTOMER, [[vx, 1]]);
    couponId = fake.coupons.seed({ code: "CANCELME", usageLimit: 1, perUserLimit: 1, discountValue: 100_000 }).id;
  });

  const place = async () => (await checkout(CUSTOMER, address, { couponCode: "CANCELME" })).body.data.id as string;
  const cancel = (orderId: string) => request(app).post(`/api/orders/${orderId}/cancel`).set(token(CUSTOMER));

  it("39) لغو سفارش پرداخت‌نشده: استفاده آزاد می‌شود، usedCount یکی کم؛ مشتری می‌تواند دوباره استفاده کند", async () => {
    const orderId = await place();
    expect(fake.coupons.get(couponId).usedCount).toBe(1);
    expect((await cancel(orderId)).status).toBe(200);
    expect(fake.coupons.get(couponId).usedCount).toBe(0);
    expect(fake.coupons.redemptions[0]).toMatchObject({ status: "RELEASED" });
    expect(fake.coupons.redemptions[0]!.releasedAt).not.toBeNull();

    fake.addToCart(CUSTOMER, vx, 1);
    const reuse = await checkout(CUSTOMER, address, { couponCode: "CANCELME" });
    expect(reuse.status).toBe(201);
    expect(fake.coupons.get(couponId).usedCount).toBe(1);
  });

  it("40) لغو مجدد و ۵ لغو موازی → فقط یک بار آزاد می‌شود (usedCount منفی/کمتر از واقع نمی‌شود)", async () => {
    const orderId = await place();
    // یک مشتری دیگر هم یک استفاده دارد؛ آزادسازی اشتباه باید آن را کم نکند
    const other = fake.coupons.seed({ code: "OTHER", usageLimit: 5, usedCount: 2 });
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => cancel(orderId)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(fake.coupons.get(couponId).usedCount).toBe(0);
    expect(fake.coupons.get(other.id).usedCount).toBe(2);
    expect(fake.coupons.redemptions.filter((r) => r.status === "RELEASED")).toHaveLength(1);
  });

  it("41) سفارش پرداخت‌شده قابل لغو نیست و استفادهٔ کوپن آزاد نمی‌شود", async () => {
    const orderId = await place();
    fake.setOrderStatus(orderId, "PAID");
    expect((await cancel(orderId)).status).toBe(409);
    expect(fake.coupons.get(couponId).usedCount).toBe(1);
    expect(fake.coupons.redemptions[0]!.status).toBe("ACTIVE");
  });

  it("42) لغو سفارش بدون کوپن هیچ کوپنی را تغییر نمی‌دهد", async () => {
    fake.addToCart(USER_B, vx, 1);
    const addrB = fake.addAddress(USER_B);
    const plain = (await checkout(USER_B, addrB)).body.data.id;
    const before = fake.coupons.get(couponId).usedCount;
    expect((await request(app).post(`/api/orders/${plain}/cancel`).set(token(USER_B))).status).toBe(200);
    expect(fake.coupons.get(couponId).usedCount).toBe(before);
  });

  it("43) شکست در لغو (ثبت حرکت انبار) → آزادسازی کوپن هم Rollback می‌شود", async () => {
    const orderId = await place();
    fake.faults.failOnRecordMovements = true;
    expect((await cancel(orderId)).status).toBe(500);
    expect(fake.coupons.get(couponId).usedCount).toBe(1);
    expect(fake.coupons.redemptions[0]!.status).toBe("ACTIVE");
    fake.faults.failOnRecordMovements = false;
    expect((await cancel(orderId)).status).toBe(200);
    expect(fake.coupons.get(couponId).usedCount).toBe(0);
  });
});

describe("یکپارچگی ادمین ↔ Checkout", () => {
  it("44) کوپن ساخته‌شده توسط ادمین با محدودیت دسته/فروشنده در Checkout اعمال می‌شود و آمار ادمین مصرف را نشان می‌دهد", async () => {
    const parent = fake.addCategory(null, "زنانه");
    const child = fake.addCategory(parent, "کت");
    const vCoat = fake.addVariant({ sellerId: sellerX, stock: 5, basePrice: 2_000_000, categoryId: child });
    const vOther = fake.addVariant({ sellerId: sellerX, stock: 5, basePrice: 1_000_000 });
    const addr = shopper(CUSTOMER, [
      [vCoat, 1],
      [vOther, 1],
    ]);
    const created = await request(app)
      .post("/api/admin/coupons")
      .set(token(ADMIN, "ADMIN"))
      .send({
        code: "women-15",
        discountType: "PERCENTAGE",
        discountValue: 15,
        categoryIds: [parent],
        sellerId: sellerX,
        usageLimit: 10,
      });
    expect(created.status).toBe(201);

    const res = await checkout(CUSTOMER, addr, { couponCode: "WOMEN-15" });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ subtotal: 3_000_000, discountAmount: 300_000, totalAmount: 2_700_000 });

    const detail = await request(app).get(`/api/admin/coupons/${created.body.data.id}`).set(token(ADMIN, "ADMIN"));
    expect(detail.body.data.stats).toEqual({ usedCount: 1, releasedCount: 0, remaining: 9, totalDiscountAmount: 300_000 });
  });

  it("45) ادمین کوپن را غیرفعال کند، مشتری دیگر نمی‌تواند از آن استفاده کند ولی سفارش قبلی دست‌نخورده است", async () => {
    const vx = fake.addVariant({ sellerId: sellerX, stock: 9, basePrice: 1_000_000 });
    const addrA = shopper(CUSTOMER, [[vx, 1]]);
    const c = fake.coupons.seed({ code: "KILL", discountValue: 100_000 });
    const early = await checkout(CUSTOMER, addrA, { couponCode: "KILL" });
    expect(early.status).toBe(201);

    await request(app).patch(`/api/admin/coupons/${c.id}/status`).set(token(ADMIN, "ADMIN")).send({ isActive: false });
    const addrB = shopper(USER_B, [[vx, 1]]);
    expect((await checkout(USER_B, addrB, { couponCode: "KILL" })).status).toBe(422);
    const old = await request(app).get(`/api/orders/${early.body.data.id}`).set(token(CUSTOMER));
    expect(old.body.data).toMatchObject({ discountAmount: 100_000, couponCode: "KILL" });
  });
});
