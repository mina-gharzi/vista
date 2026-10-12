import express, { type Express } from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deriveOrderFulfillment,
  isOrderCancellableByCustomer,
  type FulfillmentStatus,
} from "@vista/shared";
import { errorHandler } from "../../src/middlewares/errorHandler";
import { createOrdersController } from "../../src/modules/orders/orders.controller";
import { createCheckoutRouter, createOrdersHistoryRouter } from "../../src/modules/orders/orders.routes";
import { createOrdersService } from "../../src/modules/orders/orders.service";
import type { OrdersRepository } from "../../src/modules/orders/orders.repository";
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

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const MISSING = "00000000-0000-4000-8000-999999999999";

let fake: ReturnType<typeof createFakeOrdersRepository>;
let sellerX: string;
let sellerY: string;

const auth = (userId: string) => ({
  Authorization: `Bearer ${signAccessToken({ userId, role: "CUSTOMER" })}`,
});

function buildApp(provider: PaymentProvider | null = null, repo: OrdersRepository = fake.repository): Express {
  const controller = createOrdersController(createOrdersService(repo, provider));
  const app = express();
  app.use(express.json());
  app.use("/api/checkout", createCheckoutRouter(controller));
  app.use("/api/orders", createOrdersHistoryRouter(controller));
  app.use(errorHandler);
  return app;
}

let app: Express;

const checkout = (
  userId: string,
  addressId: string,
  extra: Record<string, unknown> = {},
  application: Express = app,
) =>
  request(application)
    .post("/api/checkout")
    .set(auth(userId))
    .send({ addressId, checkoutKey: randomUUID(), ...extra });

/** کاربر با آدرس و سبدی از [variantId, qty]ها */
function customer(userId: string, lines: [string, number][]) {
  const addressId = fake.addAddress(userId);
  for (const [variantId, qty] of lines) fake.addToCart(userId, variantId, qty);
  return addressId;
}

beforeEach(() => {
  fake = createFakeOrdersRepository();
  sellerX = fake.addSeller("APPROVED", "فروشگاه X");
  sellerY = fake.addSeller("APPROVED", "فروشگاه Y");
  app = buildApp(null);
});

describe("دسترسی و اعتبارسنجی", () => {
  it("1) بدون توکن → 401 روی همهٔ مسیرها", async () => {
    expect((await request(app).post("/api/checkout").send({})).status).toBe(401);
    expect((await request(app).get("/api/orders")).status).toBe(401);
    expect((await request(app).get(`/api/orders/${MISSING}`)).status).toBe(401);
    expect((await request(app).post(`/api/orders/${MISSING}/cancel`)).status).toBe(401);
  });

  it("2) بدنهٔ نامعتبر → 400 و هیچ اثری روی موجودی/سبد", async () => {
    const v = fake.addVariant({ sellerId: sellerX, stock: 3 });
    const addressId = customer(USER_A, [[v, 1]]);
    const noKey = await request(app).post("/api/checkout").set(auth(USER_A)).send({ addressId });
    expect(noKey.status).toBe(400);
    const badKey = await checkout(USER_A, addressId, { checkoutKey: "abc" });
    expect(badKey.status).toBe(400);
    const badAddress = await checkout(USER_A, "not-a-uuid");
    expect(badAddress.status).toBe(400);
    const badTotal = await checkout(USER_A, addressId, { expectedTotal: -5 });
    expect(badTotal.status).toBe(400);
    expect(fake.stock(v)).toBe(3);
    expect(fake.cart(USER_A)).toHaveLength(1);
  });

  it("3) userId/مبلغ/قیمت ارسالی از Client نادیده گرفته می‌شود", async () => {
    const v = fake.addVariant({ sellerId: sellerX, stock: 5, basePrice: 2_000_000 });
    const addressId = customer(USER_A, [[v, 2]]);
    const res = await checkout(USER_A, addressId, {
      userId: USER_B,
      totalAmount: 1,
      subtotal: 1,
      shippingCost: 0,
      status: "PAID",
      unitPrice: 1,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.totalAmount).toBe(4_000_000);
    expect(res.body.data.status).toBe("PENDING");
    expect(fake.orders[0]?.userId).toBe(USER_A);
  });
});

describe("Checkout موفق", () => {
  it("4) تک‌فروشنده: قیمت از DB (قیمت تنوع بر basePrice)، Snapshot، کسر موجودی، حرکت انبار، خالی‌شدن سبد", async () => {
    const v1 = fake.addVariant({ sellerId: sellerX, stock: 10, basePrice: 1_000_000, price: 1_200_000, title: "کت" });
    const v2 = fake.addVariant({ sellerId: sellerX, stock: 4, basePrice: 500_000 });
    const addressId = customer(USER_A, [[v1, 2], [v2, 1]]);
    const res = await checkout(USER_A, addressId);
    expect(res.status).toBe(201);
    const order = res.body.data;
    expect(order.subtotal).toBe(2 * 1_200_000 + 500_000);
    expect(order.totalAmount).toBe(order.subtotal);
    expect(order.shippingCost).toBe(0);
    expect(order.sellerOrders).toHaveLength(1);
    expect(order.sellerOrders[0].items.map((i: { unitPrice: number }) => i.unitPrice).sort((p: number, q: number) => p - q)).toEqual([500_000, 1_200_000]);
    expect(order.shippingAddress.city).toBe("تهران");
    expect(order.canCancel).toBe(true);
    expect(fake.stock(v1)).toBe(8);
    expect(fake.stock(v2)).toBe(3);
    expect(fake.movementsFor(v1)).toMatchObject([
      { type: "ORDER_PLACED", quantityDelta: -2, stockAfter: 8, orderId: order.id, actorId: USER_A },
    ]);
    expect(fake.cart(USER_A)).toEqual([]);
  });

  it("5) چندفروشنده: به ازای هر فروشنده یک SellerOrder با جمع درست", async () => {
    const a = fake.addVariant({ sellerId: sellerX, stock: 5, basePrice: 100 });
    const b = fake.addVariant({ sellerId: sellerY, stock: 5, basePrice: 300 });
    const addressId = customer(USER_A, [[a, 2], [b, 1]]);
    const res = await checkout(USER_A, addressId);
    expect(res.status).toBe(201);
    const sos = res.body.data.sellerOrders as { sellerStoreName: string; subtotal: number }[];
    expect(sos).toHaveLength(2);
    expect(sos.find((s) => s.sellerStoreName === "فروشگاه X")?.subtotal).toBe(200);
    expect(sos.find((s) => s.sellerStoreName === "فروشگاه Y")?.subtotal).toBe(300);
    expect(res.body.data.totalAmount).toBe(500);
    expect(res.body.data.fulfillment).toMatchObject({ state: "PENDING", totalParcels: 2 });
  });

  it("6) آدرس دیگران → 404 و هیچ تغییری", async () => {
    const v = fake.addVariant({ sellerId: sellerX, stock: 3 });
    customer(USER_A, [[v, 1]]);
    const otherAddress = fake.addAddress(USER_B);
    const res = await checkout(USER_A, otherAddress);
    expect(res.status).toBe(404);
    expect(fake.stock(v)).toBe(3);
    expect(fake.cart(USER_A)).toHaveLength(1);
    expect(fake.orders).toHaveLength(0);
  });

  it("7) سبد خالی → 409 با کد CHECKOUT_EMPTY_CART", async () => {
    const addressId = fake.addAddress(USER_A);
    const res = await checkout(USER_A, addressId);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CHECKOUT_EMPTY_CART");
  });
});

describe("کالای نامعتبر و تغییر قیمت", () => {
  it("8) منتشرنشده/تنوع غیرفعال/فروشنده تعلیق/موجودی ناکافی: همه یک‌جا گزارش می‌شوند و هیچ چیز تغییر نمی‌کند", async () => {
    const ok = fake.addVariant({ sellerId: sellerX, stock: 5 });
    const draft = fake.addVariant({ sellerId: sellerX, stock: 5, productStatus: "DRAFT" });
    const inactive = fake.addVariant({ sellerId: sellerX, stock: 5, active: false });
    const suspendedSeller = fake.addSeller("SUSPENDED");
    const suspended = fake.addVariant({ sellerId: suspendedSeller, stock: 5 });
    const low = fake.addVariant({ sellerId: sellerX, stock: 1 });
    const addressId = customer(USER_A, [[ok, 1], [draft, 1], [inactive, 1], [suspended, 1], [low, 3]]);

    const res = await checkout(USER_A, addressId);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CHECKOUT_ITEMS_UNAVAILABLE");
    const d = res.body.error.details;
    expect(d[draft]).toEqual(["UNAVAILABLE", "0"]);
    expect(d[inactive]).toEqual(["UNAVAILABLE", "0"]);
    expect(d[suspended]).toEqual(["UNAVAILABLE", "0"]);
    expect(d[low]).toEqual(["INSUFFICIENT_STOCK", "1"]);
    expect(d[ok]).toBeUndefined();
    expect(fake.stock(ok)).toBe(5);
    expect(fake.cart(USER_A)).toHaveLength(5);
    expect(fake.orders).toHaveLength(0);
    expect(fake.movements).toHaveLength(0);
  });

  it("9) تغییر قیمت: expectedTotal متفاوت → 409 PRICE_CHANGED بدون ثبت سفارش؛ با مبلغ درست ثبت می‌شود", async () => {
    const v = fake.addVariant({ sellerId: sellerX, stock: 5, basePrice: 1_000 });
    const addressId = customer(USER_A, [[v, 2]]);
    const stale = await checkout(USER_A, addressId, { expectedTotal: 1_500 });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("CHECKOUT_PRICE_CHANGED");
    expect(stale.body.error.details).toEqual({ expectedTotal: ["1500"], actualTotal: ["2000"] });
    expect(fake.orders).toHaveLength(0);
    expect(fake.stock(v)).toBe(5);
    expect(fake.cart(USER_A)).toHaveLength(1);

    const ok = await checkout(USER_A, addressId, { expectedTotal: 2_000 });
    expect(ok.status).toBe(201);
  });
});

describe("اتمیک بودن", () => {
  it("10) شکست در ساخت سفارش یا ثبت حرکت انبار → Rollback کامل (موجودی، سبد، سفارش، حرکت)", async () => {
    const v = fake.addVariant({ sellerId: sellerX, stock: 5 });
    const addressId = customer(USER_A, [[v, 2]]);

    fake.faults.failOnCreateOrder = true;
    expect((await checkout(USER_A, addressId)).status).toBe(500);
    fake.faults.failOnCreateOrder = false;
    fake.faults.failOnRecordMovements = true;
    expect((await checkout(USER_A, addressId)).status).toBe(500);
    fake.faults.failOnRecordMovements = false;

    expect(fake.stock(v)).toBe(5);
    expect(fake.cart(USER_A)).toEqual([{ variantId: v, quantity: 2 }]);
    expect(fake.orders).toHaveLength(0);
    expect(fake.movements).toHaveLength(0);

    // و بعد از رفع خطا همان سبد ثبت می‌شود
    expect((await checkout(USER_A, addressId)).status).toBe(201);
    expect(fake.stock(v)).toBe(3);
  });

  it("11) Rollback وسط رقابت: کسر موفقِ یک خط پس از شکست خط دیگر برگردانده می‌شود (نشت موجودی ندارد)", async () => {
    const x = fake.addVariant({ sellerId: sellerX, stock: 5 });
    const y = fake.addVariant({ sellerId: sellerX, stock: 1 });
    const addrA = customer(USER_A, [[x, 1], [y, 1]]);
    const addrB = customer(USER_B, [[y, 1]]);
    const [ra, rb] = await Promise.all([checkout(USER_A, addrA), checkout(USER_B, addrB)]);
    const statuses = [ra.status, rb.status].sort();
    expect(statuses).toEqual([201, 409]);
    expect(fake.orders).toHaveLength(1);
    expect(fake.stock(y)).toBe(0);
    expect(fake.stock(x)).toBe(ra.status === 201 ? 4 : 5);
    expect(fake.movements.filter((m) => m.type === "ORDER_PLACED")).toHaveLength(ra.status === 201 ? 2 : 1);
    // سبد بازنده دست‌نخورده است
    expect(fake.cart(ra.status === 201 ? USER_B : USER_A).length).toBeGreaterThan(0);
  });
});

describe("Idempotency", () => {
  it("12) همان checkoutKey دوباره → همان سفارش (200)، موجودی فقط یک‌بار کم شده", async () => {
    const v = fake.addVariant({ sellerId: sellerX, stock: 5 });
    const addressId = customer(USER_A, [[v, 2]]);
    const checkoutKey = randomUUID();
    const first = await checkout(USER_A, addressId, { checkoutKey });
    const second = await checkout(USER_A, addressId, { checkoutKey });
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(fake.orders).toHaveLength(1);
    expect(fake.stock(v)).toBe(3);
    expect(fake.movementsFor(v)).toHaveLength(1);
  });

  it("13) ۶ درخواست موازی با یک کلید → دقیقاً یک سفارش و یک کسر", async () => {
    const v = fake.addVariant({ sellerId: sellerX, stock: 1 });
    const addressId = customer(USER_A, [[v, 1]]);
    const checkoutKey = randomUUID();
    const results = await Promise.all(Array.from({ length: 6 }, () => checkout(USER_A, addressId, { checkoutKey })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 200)).toHaveLength(5);
    expect(new Set(results.map((r) => r.body.data.id)).size).toBe(1);
    expect(fake.orders).toHaveLength(1);
    expect(fake.stock(v)).toBe(0);
  });

  it("14) کلید جدید بعد از موفقیت و سبد خالی → 409؛ کلید هر کاربر مستقل است", async () => {
    const v = fake.addVariant({ sellerId: sellerX, stock: 5 });
    const addrA = customer(USER_A, [[v, 1]]);
    const addrB = customer(USER_B, [[v, 1]]);
    const checkoutKey = randomUUID();
    expect((await checkout(USER_A, addrA, { checkoutKey })).status).toBe(201);
    expect((await checkout(USER_A, addrA)).status).toBe(409);
    const b = await checkout(USER_B, addrB, { checkoutKey });
    expect(b.status).toBe(201);
    expect(fake.orders).toHaveLength(2);
    expect(fake.stock(v)).toBe(3);
  });

  it("15) برخورد با ایندکس یکتای DB (خط دفاع آخر): Rollback و بازگرداندن سفارش اول", async () => {
    const v = fake.addVariant({ sellerId: sellerX, stock: 5 });
    const addressId = customer(USER_A, [[v, 1]]);
    const checkoutKey = randomUUID();
    const first = await checkout(USER_A, addressId, { checkoutKey });
    expect(first.status).toBe(201);

    // شبیه‌سازی Race: بررسی اولیهٔ کلید چیزی نمی‌بیند ولی INSERT به ایندکس یکتا برمی‌خورد
    const racy: OrdersRepository = {
      ...fake.repository,
      transaction: (work) =>
        fake.repository.transaction((tx) => work({ ...tx, findByCheckoutKey: async () => null })),
    };
    fake.addToCart(USER_A, v, 1);
    const second = await checkout(USER_A, addressId, { checkoutKey }, buildApp(null, racy));
    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(fake.orders).toHaveLength(1);
    expect(fake.stock(v)).toBe(4); // کسر تلاش دوم Rollback شد
    expect(fake.cart(USER_A)).toHaveLength(1);
  });
});

describe("موجودی و همزمانی", () => {
  it("16) آخرین واحد: ۱۰ خریدار همزمان → فقط یک موفقیت، موجودی هرگز منفی نمی‌شود", async () => {
    const v = fake.addVariant({ sellerId: sellerX, stock: 1 });
    const buyers = Array.from({ length: 10 }, () => randomUUID());
    const addresses = buyers.map((id) => customer(id, [[v, 1]]));
    const results = await Promise.all(buyers.map((id, i) => checkout(id, addresses[i] as string)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(9);
    expect(fake.stock(v)).toBe(0);
    expect(fake.orders).toHaveLength(1);
    expect(fake.movementsFor(v)).toHaveLength(1);
  });

  it("17) موجودی ۵ و ۸ خریدار ۲تایی همزمان → دقیقاً ۲ سفارش و ۱ واحد باقی", async () => {
    const v = fake.addVariant({ sellerId: sellerX, stock: 5 });
    const buyers = Array.from({ length: 8 }, () => randomUUID());
    const addresses = buyers.map((id) => customer(id, [[v, 2]]));
    const results = await Promise.all(buyers.map((id, i) => checkout(id, addresses[i] as string)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(2);
    expect(fake.stock(v)).toBe(1);
    const sold = fake.movementsFor(v).reduce((sum, m) => sum + m.quantityDelta, 0);
    expect(sold).toBe(-4);
  });
});

describe("مرز پرداخت", () => {
  it("18) بدون Provider: سفارش PENDING می‌ماند و paidAt ندارد؛ نشتی اطلاعات پرداخت ندارد", async () => {
    const v = fake.addVariant({ sellerId: sellerX, stock: 5 });
    const addressId = customer(USER_A, [[v, 1]]);
    const res = await checkout(USER_A, addressId, { status: "PAID", paymentRef: "x", paidAt: "2026-01-01" });
    expect(res.body.data.status).toBe("PENDING");
    expect(res.body.data.paidAt).toBeNull();
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/paymentRef|providerRef|userId|sellerId|"sku"/);
  });

  it("19) فقط Mock توسعه (در سرویس تزریق‌شده) PAID می‌کند؛ ناموفق بودن تأیید → PENDING", async () => {
    const v = fake.addVariant({ sellerId: sellerX, stock: 5 });
    const addressId = customer(USER_A, [[v, 1]]);
    const paid = await checkout(USER_A, addressId, {}, buildApp(new MockPaymentProvider()));
    expect(paid.body.data.status).toBe("PAID");
    expect(paid.body.data.paidAt).not.toBeNull();

    const failing: PaymentProvider = {
      createPaymentSession: async () => ({ redirectUrl: "x", providerRef: "r" }),
      verifyPayment: async () => ({ success: false, transactionId: "" }),
    };
    fake.addToCart(USER_A, v, 1);
    const pending = await checkout(USER_A, addressId, {}, buildApp(failing));
    expect(pending.body.data.status).toBe("PENDING");
  });
});

describe("لغو سفارش", () => {
  async function placeOrder(userId = USER_A, provider: PaymentProvider | null = null) {
    const a = fake.addVariant({ sellerId: sellerX, stock: 5 });
    const b = fake.addVariant({ sellerId: sellerY, stock: 5 });
    const addressId = customer(userId, [[a, 2], [b, 1]]);
    const res = await checkout(userId, addressId, {}, buildApp(provider));
    expect(res.status).toBe(201);
    return { a, b, orderId: res.body.data.id as string };
  }
  const cancel = (userId: string, orderId: string) =>
    request(app).post(`/api/orders/${orderId}/cancel`).set(auth(userId));

  it("20) لغو سفارش پرداخت‌نشده: وضعیت‌ها CANCELLED، موجودی همهٔ فروشنده‌ها برمی‌گردد، حرکت ORDER_CANCELLED", async () => {
    const { a, b, orderId } = await placeOrder();
    expect(fake.stock(a)).toBe(3);
    const res = await cancel(USER_A, orderId);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("CANCELLED");
    expect(res.body.data.cancelledAt).not.toBeNull();
    expect(res.body.data.sellerOrders.every((s: { status: string }) => s.status === "CANCELLED")).toBe(true);
    expect(res.body.data.fulfillment.state).toBe("CANCELLED");
    expect(res.body.data.canCancel).toBe(false);
    expect(fake.stock(a)).toBe(5);
    expect(fake.stock(b)).toBe(5);
    expect(fake.movementsFor(a).map((m) => m.type)).toEqual(["ORDER_PLACED", "ORDER_CANCELLED"]);
    expect(fake.movementsFor(a)[1]).toMatchObject({ quantityDelta: 2, stockAfter: 5, orderId });
  });

  it("21) لغوِ دوباره و ۵ لغوِ موازی → موفق ولی موجودی فقط یک‌بار برمی‌گردد", async () => {
    const { a, orderId } = await placeOrder();
    const results = await Promise.all(Array.from({ length: 5 }, () => cancel(USER_A, orderId)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect((await cancel(USER_A, orderId)).status).toBe(200);
    expect(fake.stock(a)).toBe(5);
    expect(fake.movementsFor(a).filter((m) => m.type === "ORDER_CANCELLED")).toHaveLength(1);
  });

  it("22) سفارش پرداخت‌شده قابل لغو نیست (بازگشت وجه پیاده نشده) → 409 و موجودی دست‌نخورده", async () => {
    const { a, orderId } = await placeOrder(USER_A, new MockPaymentProvider());
    const res = await cancel(USER_A, orderId);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ORDER_NOT_CANCELLABLE");
    expect(fake.stock(a)).toBe(3);
    expect(fake.orders[0]?.status).toBe("PAID");
  });

  it("23) سفارش دیگران/ناموجود → 404، شناسهٔ نامعتبر → 400", async () => {
    const { a, orderId } = await placeOrder();
    expect((await cancel(USER_B, orderId)).status).toBe(404);
    expect((await cancel(USER_A, MISSING)).status).toBe(404);
    expect((await cancel(USER_A, "nope")).status).toBe(400);
    expect(fake.orders[0]?.status).toBe("PENDING");
    expect(fake.stock(a)).toBe(3);
  });

  it("24) اگر یکی از SellerOrderها از PENDING جلوتر رفته باشد لغو رد می‌شود", async () => {
    const { a, orderId } = await placeOrder();
    fake.setSellerOrderStatus(orderId, sellerX, "PROCESSING");
    const res = await cancel(USER_A, orderId);
    expect(res.status).toBe(409);
    expect(fake.stock(a)).toBe(3);
    expect(fake.orders[0]?.status).toBe("PENDING");
  });

  it("25) رقابت پرداخت و لغو: CAS اجازه نمی‌دهد سفارش لغوشده PAID شود، و پرداخت‌شده لغو نمی‌شود", async () => {
    const first = await placeOrder();
    expect((await cancel(USER_A, first.orderId)).status).toBe(200);
    expect(await fake.repository.markPaid(first.orderId, "ref")).toBe(false);
    expect(fake.orders.find((o) => o.id === first.orderId)?.status).toBe("CANCELLED");

    const second = await placeOrder(USER_B);
    expect(await fake.repository.markPaid(second.orderId, "ref")).toBe(true);
    expect((await cancel(USER_B, second.orderId)).status).toBe(409);
    expect(fake.orders.find((o) => o.id === second.orderId)?.status).toBe("PAID");
  });

  it("26) Rollback لغو: خطا در ثبت حرکت انبار → وضعیت و موجودی برنمی‌گردد نیمه‌کاره", async () => {
    const { a, orderId } = await placeOrder();
    fake.faults.failOnRecordMovements = true;
    expect((await cancel(USER_A, orderId)).status).toBe(500);
    fake.faults.failOnRecordMovements = false;
    expect(fake.orders[0]?.status).toBe("PENDING");
    expect(fake.orders[0]?.sellerOrders.every((s) => s.status === "PENDING")).toBe(true);
    expect(fake.stock(a)).toBe(3);
    expect((await cancel(USER_A, orderId)).status).toBe(200);
    expect(fake.stock(a)).toBe(5);
  });
});

describe("تاریخچه و جزئیات سفارش", () => {
  it("27) فقط سفارش‌های خود کاربر؛ صفحه‌بندی، فیلتر وضعیت، جدیدترین اول", async () => {
    const v = fake.addVariant({ sellerId: sellerX, stock: 50, basePrice: 100 });
    const addrA = fake.addAddress(USER_A);
    const addrB = fake.addAddress(USER_B);
    const ids: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      fake.addToCart(USER_A, v, 1);
      ids.push((await checkout(USER_A, addrA)).body.data.id);
    }
    fake.addToCart(USER_B, v, 1);
    await checkout(USER_B, addrB);
    await request(app).post(`/api/orders/${ids[0]}/cancel`).set(auth(USER_A));

    const page1 = await request(app).get("/api/orders?limit=2&page=1").set(auth(USER_A));
    expect(page1.body.data.pagination).toMatchObject({ total: 5, totalPages: 3, limit: 2 });
    expect(page1.body.data.data.map((o: { id: string }) => o.id)).toEqual([ids[4], ids[3]]);
    const page3 = await request(app).get("/api/orders?limit=2&page=3").set(auth(USER_A));
    expect(page3.body.data.data.map((o: { id: string }) => o.id)).toEqual([ids[0]]);

    const cancelled = await request(app).get("/api/orders?status=CANCELLED").set(auth(USER_A));
    expect(cancelled.body.data.data.map((o: { id: string }) => o.id)).toEqual([ids[0]]);
    const pending = await request(app).get("/api/orders?status=PENDING").set(auth(USER_A));
    expect(pending.body.data.pagination.total).toBe(4);
    expect((await request(app).get("/api/orders?status=BOGUS").set(auth(USER_A))).status).toBe(400);

    const mineB = await request(app).get("/api/orders").set(auth(USER_B));
    expect(mineB.body.data.pagination.total).toBe(1);
    const item = page1.body.data.data[0];
    expect(item).toMatchObject({ itemCount: 1, totalAmount: 100, canCancel: true });
    expect(item.fulfillment.state).toBe("PENDING");
  });

  it("28) جزئیات: مالکیت (دیگران → 404)، کد رهگیری، وضعیت والد از SellerOrderها مشتق می‌شود و Order.status را عوض نمی‌کند", async () => {
    const a = fake.addVariant({ sellerId: sellerX, stock: 5 });
    const b = fake.addVariant({ sellerId: sellerY, stock: 5 });
    const addressId = customer(USER_A, [[a, 1], [b, 1]]);
    const created = await checkout(USER_A, addressId, {}, buildApp(new MockPaymentProvider()));
    const orderId = created.body.data.id as string;
    fake.setSellerOrderStatus(orderId, sellerX, "SHIPPED", "TRK-123");

    const res = await request(app).get(`/api/orders/${orderId}`).set(auth(USER_A));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("PAID");
    expect(res.body.data.fulfillment).toMatchObject({ state: "PARTIALLY_SHIPPED", shippedParcels: 1, totalParcels: 2 });
    const x = res.body.data.sellerOrders.find((s: { sellerStoreName: string }) => s.sellerStoreName === "فروشگاه X");
    const y = res.body.data.sellerOrders.find((s: { sellerStoreName: string }) => s.sellerStoreName === "فروشگاه Y");
    expect(x.trackingCode).toBe("TRK-123");
    expect(y.trackingCode).toBeNull();
    expect(res.body.data.canCancel).toBe(false);

    expect((await request(app).get(`/api/orders/${orderId}`).set(auth(USER_B))).status).toBe(404);
    expect((await request(app).get(`/api/orders/${MISSING}`).set(auth(USER_A))).status).toBe(404);
    expect((await request(app).get("/api/orders/abc").set(auth(USER_A))).status).toBe(400);
  });
});

describe("منطق مشترک چرخهٔ عمر (shared)", () => {
  const derive = (...s: FulfillmentStatus[]) => deriveOrderFulfillment(s).state;

  it("29) وضعیت والد از SellerOrderها", () => {
    expect(derive()).toBe("PENDING");
    expect(derive("PENDING", "PENDING")).toBe("PENDING");
    expect(derive("PROCESSING", "PENDING")).toBe("PROCESSING");
    expect(derive("SHIPPED", "PENDING")).toBe("PARTIALLY_SHIPPED");
    expect(derive("SHIPPED", "PROCESSING")).toBe("PARTIALLY_SHIPPED");
    expect(derive("SHIPPED", "SHIPPED")).toBe("SHIPPED");
    expect(derive("DELIVERED", "SHIPPED")).toBe("SHIPPED");
    expect(derive("DELIVERED", "DELIVERED")).toBe("DELIVERED");
    expect(derive("CANCELLED", "CANCELLED")).toBe("CANCELLED");
    expect(derive("CANCELLED", "DELIVERED")).toBe("DELIVERED");
    expect(derive("CANCELLED", "PENDING")).toBe("PENDING");
    expect(deriveOrderFulfillment(["CANCELLED", "SHIPPED", "DELIVERED"])).toMatchObject({
      totalParcels: 2,
      shippedParcels: 2,
      deliveredParcels: 1,
    });
  });

  it("30) قانون لغو مشتری", () => {
    expect(isOrderCancellableByCustomer("PENDING", ["PENDING", "PENDING"])).toBe(true);
    expect(isOrderCancellableByCustomer("PENDING", ["PENDING", "PROCESSING"])).toBe(false);
    expect(isOrderCancellableByCustomer("PAID", ["PENDING"])).toBe(false);
    expect(isOrderCancellableByCustomer("CANCELLED", ["CANCELLED"])).toBe(false);
    expect(isOrderCancellableByCustomer("REFUNDED", ["PENDING"])).toBe(false);
  });
});
