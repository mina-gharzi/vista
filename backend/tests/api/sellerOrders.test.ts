import express, { type Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { errorHandler } from "../../src/middlewares/errorHandler";
import { createSellerOrdersController } from "../../src/modules/sellerOrders/sellerOrders.controller";
import { createSellerOrdersRepository } from "../../src/modules/sellerOrders/sellerOrders.repository";
import { createSellerOrdersRouter } from "../../src/modules/sellerOrders/sellerOrders.routes";
import { createSellerOrdersService } from "../../src/modules/sellerOrders/sellerOrders.service";
import { signAccessToken } from "../../src/utils/tokens";
import { createFakeSellerOrdersRepository } from "../helpers/fakeSellerOrdersRepository";

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
let fake: ReturnType<typeof createFakeSellerOrdersRepository>;
let sellerA: string;
let sellerB: string;

const auth = (userId: string, role: "CUSTOMER" | "SELLER" | "ADMIN" = "SELLER") =>
  `Bearer ${signAccessToken({ userId, role })}`;
const asA = () => ({ Authorization: auth(USER_A) });
const url = (suffix = "") => `/api/seller/orders${suffix}`;
const patch = (id: string, body: unknown, headers = asA()) =>
  request(app).patch(url(`/${id}/status`)).set(headers).send(body as object);

beforeEach(() => {
  fake = createFakeSellerOrdersRepository();
  sellerA = fake.addSeller(USER_A, "APPROVED");
  sellerB = fake.addSeller(USER_B, "APPROVED");
  fake.addSeller(PENDING_USER, "PENDING");

  app = express();
  app.use(express.json());
  app.use(
    "/api/seller/orders",
    createSellerOrdersRouter(createSellerOrdersController(createSellerOrdersService(fake.repository))),
  );
  app.use(errorHandler);
});

/** سفارش پرداخت‌شده با یک SellerOrder برای A و در صورت نیاز یکی برای B */
function paidOrderForA(status: "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" = "PENDING") {
  const orderId = fake.addOrder();
  return { orderId, soA: fake.addSellerOrder(orderId, sellerA, { status }) };
}

describe("دسترسی", () => {
  it("1) بدون احراز هویت → 401", async () => {
    const { soA } = paidOrderForA();
    expect((await request(app).get(url())).status).toBe(401);
    expect((await request(app).get(url("/summary"))).status).toBe(401);
    expect((await request(app).get(url(`/${soA}`))).status).toBe(401);
    expect((await request(app).patch(url(`/${soA}/status`)).send({ status: "PROCESSING" })).status).toBe(401);
  });

  it("2) مشتری → 403 (حتی با بدنه نامعتبر) و وضعیت دست‌نخورده", async () => {
    const { soA } = paidOrderForA();
    const customer = { Authorization: auth(CUSTOMER, "CUSTOMER") };
    expect((await request(app).get(url()).set(customer)).status).toBe(403);
    expect((await patch(soA, { status: "PROCESSING" }, customer)).status).toBe(403);
    expect((await patch(soA, {}, customer)).status).toBe(403);
    expect(fake.get(soA).status).toBe("PENDING");
    expect(fake.events).toHaveLength(0);
  });

  it("3) فروشنده تأییدنشده → 403 برای خواندن و تغییر", async () => {
    const { soA } = paidOrderForA();
    const pending = { Authorization: auth(PENDING_USER) };
    expect((await request(app).get(url()).set(pending)).status).toBe(403);
    expect((await patch(soA, { status: "PROCESSING" }, pending)).status).toBe(403);
    expect(fake.get(soA).status).toBe("PENDING");
  });

  it("4) فروشنده تأییدشده مجاز است (حتی با توکن کهنه CUSTOMER)", async () => {
    paidOrderForA();
    const res = await request(app).get(url()).set("Authorization", auth(USER_A, "CUSTOMER"));
    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(1);
  });
});

describe("جداسازی فروشندگان و سفارش چندفروشنده", () => {
  it("5) فروشنده A سفارش B را نه می‌بیند، نه می‌خواند، نه تغییر می‌دهد", async () => {
    const orderB = fake.addOrder();
    const soB = fake.addSellerOrder(orderB, sellerB, { items: [{ title: "کفش چرم", sku: "SHOE-B", quantity: 1, unitPrice: 900_000 }] });
    paidOrderForA();

    const list = await request(app).get(url()).set(asA());
    expect(list.body.data.data).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toContain(soB);

    expect((await request(app).get(url(`/${soB}`)).set(asA())).status).toBe(404);
    expect((await patch(soB, { status: "PROCESSING" })).status).toBe(404);
    expect(fake.get(soB).status).toBe("PENDING");
    expect(fake.events).toHaveLength(0);
  });

  it("6) سفارش چندفروشنده: هر فروشنده فقط اقلام، جمع و کد خودش را می‌بیند", async () => {
    const orderId = fake.addOrder({ orderNumber: 5001 });
    const soA = fake.addSellerOrder(orderId, sellerA, { items: [{ title: "کت پشمی", sku: "COAT-A", quantity: 2, unitPrice: 500_000 }] });
    fake.addSellerOrder(orderId, sellerB, { items: [{ title: "کفش چرم", sku: "SHOE-B", quantity: 3, unitPrice: 900_000 }] });

    const detail = await request(app).get(url(`/${soA}`)).set(asA());
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({ orderNumber: 5001, subtotal: 1_000_000 });
    expect(detail.body.data.items).toHaveLength(1);
    expect(detail.body.data.items[0]).toMatchObject({ sku: "COAT-A", quantity: 2, unitPrice: 500_000, lineTotal: 1_000_000 });
    const text = JSON.stringify(detail.body);
    for (const leak of ["کفش چرم", "SHOE-B", "2700000", "900000"]) expect(text).not.toContain(leak);

    const list = await request(app).get(url()).set(asA());
    expect(list.body.data.data[0]).toMatchObject({ subtotal: 1_000_000, itemCount: 2 });
    expect(JSON.stringify(list.body)).not.toContain("کفش");
  });

  it("7) اطلاعات مشتری: فقط گیرنده لازم برای ارسال؛ بدون ایمیل/شناسه کاربر؛ در فهرست هیچ‌چیز", async () => {
    const { soA } = paidOrderForA();
    const detail = await request(app).get(url(`/${soA}`)).set(asA());
    expect(detail.body.data.shipping).toMatchObject({ fullName: "گیرنده نمونه", phone: "09120000000" });
    const list = await request(app).get(url()).set(asA());
    for (const body of [detail.body, list.body]) {
      expect(JSON.stringify(body)).not.toContain("customer-secret@example.com");
      expect(JSON.stringify(body)).not.toMatch(/userId|"email"/);
    }
    expect(JSON.stringify(list.body)).not.toContain("گیرنده نمونه");
  });

  it("7b) سفارش لغوشده: آدرس ارسال دیگر نمایش داده نمی‌شود", async () => {
    const { soA } = paidOrderForA("CANCELLED");
    const detail = await request(app).get(url(`/${soA}`)).set(asA());
    expect(detail.body.data.shipping).toBeNull();
    expect(detail.body.data.allowedTransitions).toEqual([]);
  });
});

describe("چرخه ارسال", () => {
  it("8) مسیر کامل PENDING → PROCESSING → SHIPPED → DELIVERED با تاریخچه و زمان‌ها", async () => {
    const { soA } = paidOrderForA();

    let res = await patch(soA, { status: "PROCESSING" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "PROCESSING", allowedTransitions: ["SHIPPED"] });

    res = await patch(soA, { status: "SHIPPED", trackingCode: "  RX123456789IR " });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "SHIPPED", trackingCode: "RX123456789IR", allowedTransitions: ["DELIVERED"] });
    expect(res.body.data.shippedAt).toEqual(expect.any(String));

    res = await patch(soA, { status: "DELIVERED" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "DELIVERED", allowedTransitions: [] });
    expect(res.body.data.deliveredAt).toEqual(expect.any(String));

    expect(res.body.data.history.map((h: { fromStatus: string; toStatus: string }) => `${h.fromStatus}>${h.toStatus}`)).toEqual([
      "PENDING>PROCESSING",
      "PROCESSING>SHIPPED",
      "SHIPPED>DELIVERED",
    ]);
    expect(res.body.data.history[1].trackingCode).toBe("RX123456789IR");
    expect(fake.events.map((e) => e.actorId)).toEqual([USER_A, USER_A, USER_A]);
  });

  it("9) انتقال‌های نامعتبر (پرش، تکرار، برگشت) → 409 و بدون اثر", async () => {
    const cases: [string, object][] = [
      ["PENDING", { status: "SHIPPED", trackingCode: "ABCD1234" }],
      ["PENDING", { status: "DELIVERED" }],
      ["PROCESSING", { status: "PROCESSING" }],
      ["PROCESSING", { status: "DELIVERED" }],
      ["SHIPPED", { status: "PROCESSING" }],
      ["SHIPPED", { status: "SHIPPED", trackingCode: "ABCD1234" }],
      ["DELIVERED", { status: "SHIPPED", trackingCode: "ABCD1234" }],
      ["DELIVERED", { status: "DELIVERED" }],
    ];
    for (const [status, body] of cases) {
      const { soA } = paidOrderForA(status as "PENDING");
      const res = await patch(soA, body);
      expect(res.status, `${status} → ${JSON.stringify(body)}`).toBe(409);
      expect(fake.get(soA).status).toBe(status);
    }
    expect(fake.events).toHaveLength(0);
  });

  it("9b) فروشنده نمی‌تواند به PENDING یا CANCELLED برود → 400", async () => {
    const { soA } = paidOrderForA("PROCESSING");
    for (const status of ["PENDING", "CANCELLED", "REFUNDED", "NOPE"]) {
      expect((await patch(soA, { status })).status, status).toBe(400);
    }
    expect(fake.get(soA).status).toBe("PROCESSING");
  });

  it("10) سفارش پرداخت‌نشده، لغوشده یا بازپرداخت‌شده قابل ارسال نیست (404) و دیده هم نمی‌شود", async () => {
    const ids: string[] = [];
    for (const status of ["PENDING", "CANCELLED", "REFUNDED"] as const) {
      const orderId = fake.addOrder({ status });
      ids.push(fake.addSellerOrder(orderId, sellerA, { status: "PROCESSING" }));
    }
    for (const id of ids) {
      expect((await patch(id, { status: "SHIPPED", trackingCode: "ABCD1234" })).status).toBe(404);
      expect((await request(app).get(url(`/${id}`)).set(asA())).status).toBe(404);
      expect(fake.get(id).status).toBe("PROCESSING");
    }
    expect((await request(app).get(url()).set(asA())).body.data.pagination.total).toBe(0);
  });

  it("10b) SellerOrder لغوشده قابل تغییر نیست → 409 با پیام مناسب", async () => {
    const { soA } = paidOrderForA("CANCELLED");
    const res = await patch(soA, { status: "PROCESSING" });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("سفارش لغوشده قابل تغییر نیست");
  });

  it("11) فیلد غیرمجاز (قیمت، وضعیت پرداخت، sellerId، ...) رد می‌شود و چیزی عوض نمی‌شود", async () => {
    const { soA, orderId } = paidOrderForA();
    const before = { subtotal: fake.get(soA).subtotal, sellerId: fake.get(soA).sellerId };
    for (const extra of [
      { subtotal: 1 },
      { paymentStatus: "REFUNDED" },
      { orderStatus: "CANCELLED" },
      { sellerId: sellerB },
      { unitPrice: 1 },
    ]) {
      const res = await patch(soA, { status: "PROCESSING", ...extra });
      expect(res.status, JSON.stringify(extra)).toBe(400);
    }
    expect(fake.get(soA)).toMatchObject({ status: "PENDING", ...before });
    expect(fake.orders.find((o) => o.id === orderId)?.status).toBe("PAID");
    expect(fake.events).toHaveLength(0);
  });

  it("11b) کد رهگیری: برای ارسال الزامی، فقط قالب معتبر، و برای سایر وضعیت‌ها ممنوع", async () => {
    const { soA } = paidOrderForA("PROCESSING");
    expect((await patch(soA, { status: "SHIPPED" })).status).toBe(400);
    for (const bad of ["ab", "bad code!", "x".repeat(41), "   "]) {
      expect((await patch(soA, { status: "SHIPPED", trackingCode: bad })).status, bad).toBe(400);
    }
    const pendingSo = paidOrderForA("PENDING").soA;
    expect((await patch(pendingSo, { status: "PROCESSING", trackingCode: "ABCD1234" })).status).toBe(400);
    expect(fake.get(soA).status).toBe("PROCESSING");
  });

  it("12) وضعیت سفارش والد با ارسال یک فروشنده عوض نمی‌شود و سفارش فروشنده دیگر دست‌نخورده می‌ماند", async () => {
    const orderId = fake.addOrder();
    const soA = fake.addSellerOrder(orderId, sellerA, { status: "PROCESSING" });
    const soB = fake.addSellerOrder(orderId, sellerB, { status: "PROCESSING" });
    const res = await patch(soA, { status: "SHIPPED", trackingCode: "ABCD1234" });
    expect(res.status).toBe(200);
    expect(fake.orders.find((o) => o.id === orderId)?.status).toBe("PAID");
    expect(fake.get(soB)).toMatchObject({ status: "PROCESSING", trackingCode: null });
    expect(fake.events.every((e) => e.sellerOrderId === soA)).toBe(true);
  });
});

describe("همزمانی و اتمیک‌بودن", () => {
  it("13) ۱۰ درخواست همزمان ارسال: فقط یکی موفق، بقیه 409، یک رویداد، یک کد رهگیری", async () => {
    const { soA } = paidOrderForA("PROCESSING");
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => patch(soA, { status: "SHIPPED", trackingCode: `TRACK-${i}000` })),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(9);
    expect(fake.events).toHaveLength(1);
    const winner = results.find((r) => r.status === 200)!;
    expect(fake.get(soA).trackingCode).toBe(winner.body.data.trackingCode);
    expect(fake.get(soA).status).toBe("SHIPPED");
  });

  it("13b) درخواست تکراری (دابل‌کلیک): دومی 409 «قبلاً ثبت شده» است", async () => {
    const { soA } = paidOrderForA();
    const [first, second] = await Promise.all([patch(soA, { status: "PROCESSING" }), patch(soA, { status: "PROCESSING" })]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const loser = first.status === 409 ? first : second;
    expect(loser.body.error.message).toContain("قبلاً ثبت شده");
    expect(fake.events).toHaveLength(1);
  });

  it("14) خطا هنگام ثبت رویداد → Rollback کامل وضعیت و 500 بدون جزئیات داخلی", async () => {
    const { soA } = paidOrderForA("PROCESSING");
    fake.faults.failOnEvent = true;
    const res = await patch(soA, { status: "SHIPPED", trackingCode: "ABCD1234" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("injected failure");
    expect(fake.get(soA)).toMatchObject({ status: "PROCESSING", trackingCode: null, shippedAt: null });
    expect(fake.events).toHaveLength(0);
  });

  it("15) Repository واقعی: بررسی مالک/PAID، UPDATE شرطی اسکالر و رویداد در همان Transaction؛ بدون دسترسی به موجودی", async () => {
    const calls: string[] = [];
    let capturedWhere: unknown;
    let capturedEligibility: unknown;
    const forbidden = () => {
      throw new Error("دسترسی به موجودی ممنوع است");
    };
    const state = { status: "PROCESSING" };
    const detail = {
      id: "so", createdAt: new Date(), updatedAt: new Date(), status: "SHIPPED", subtotal: 10,
      trackingCode: "ABCD1234", shippedAt: new Date(), deliveredAt: null,
      order: { orderNumber: 1, paidAt: new Date(), shippingFullName: "a", shippingPhone: "b", shippingProvince: "c", shippingCity: "d", shippingPostalCode: "e", shippingAddressLine: "f" },
      items: [], events: [],
    };
    const tx = {
      sellerOrder: {
        findFirst: async (args: { where: unknown }) => {
          calls.push("tx.findFirst");
          capturedEligibility = args.where;
          return { id: "so" };
        },
        updateMany: async (args: { where: unknown; data: { status: string } }) => {
          calls.push("tx.updateMany");
          capturedWhere = args.where;
          state.status = args.data.status;
          return { count: 1 };
        },
        findUniqueOrThrow: async () => detail,
      },
      sellerOrderEvent: {
        create: async () => {
          calls.push("tx.event");
          throw new Error("db down");
        },
      },
      productVariant: new Proxy({}, { get: forbidden }),
      inventoryMovement: new Proxy({}, { get: forbidden }),
    };
    const outside = () => {
      throw new Error("نوشتن خارج از Transaction");
    };
    const prisma = {
      sellerOrder: { updateMany: outside },
      sellerOrderEvent: { create: outside },
      productVariant: new Proxy({}, { get: forbidden }),
      inventoryMovement: new Proxy({}, { get: forbidden }),
      $transaction: async (work: (t: typeof tx) => Promise<unknown>) => {
        const snapshot = { ...state };
        try {
          return await work(tx);
        } catch (error) {
          Object.assign(state, snapshot); // Rollback
          throw error;
        }
      },
    } as unknown as PrismaClient;

    const repo = createSellerOrdersRepository(prisma);
    await expect(
      repo.applyTransition("seller-1", "so", { from: "PROCESSING", to: "SHIPPED", trackingCode: "ABCD1234", actorId: "u" }),
    ).rejects.toThrow("db down");
    expect(calls).toEqual(["tx.findFirst", "tx.updateMany", "tx.event"]);
    expect(state.status).toBe("PROCESSING");
    // مالکیت و PAID بودن والد در بررسی پیش از UPDATE
    expect(capturedEligibility).toEqual({ id: "so", sellerId: "seller-1", order: { status: "PAID" } });
    // CAS فقط با شرط‌های اسکالر (بدون فیلتر رابطه‌ای) تا یک UPDATE اتمیک بماند
    expect(capturedWhere).toEqual({ id: "so", sellerId: "seller-1", status: "PROCESSING" });
  });
});

describe("فهرست، فیلتر و صفحه‌بندی", () => {
  const T = (iso: string) => new Date(iso);

  it("16) فیلتر وضعیت، شماره سفارش و صفحه‌بندی", async () => {
    for (let i = 0; i < 5; i += 1) {
      const orderId = fake.addOrder({ orderNumber: 7000 + i });
      fake.addSellerOrder(orderId, sellerA, { status: i < 2 ? "SHIPPED" : "PENDING", createdAt: T(`2026-10-0${i + 1}T10:00:00Z`) });
    }
    const byStatus = await request(app).get(url("?status=SHIPPED")).set(asA());
    expect(byStatus.body.data.data.map((o: { orderNumber: number }) => o.orderNumber).sort()).toEqual([7000, 7001]);

    const byNumber = await request(app).get(url("?q=7003")).set(asA());
    expect(byNumber.body.data.data).toHaveLength(1);
    expect(byNumber.body.data.data[0].orderNumber).toBe(7003);
    expect((await request(app).get(url("?q=9999")).set(asA())).body.data.data).toHaveLength(0);

    const p1 = await request(app).get(url("?limit=2&page=1")).set(asA());
    const p3 = await request(app).get(url("?limit=2&page=3")).set(asA());
    expect(p1.body.data.pagination).toMatchObject({ total: 5, totalPages: 3, page: 1, limit: 2 });
    expect(p1.body.data.data.map((o: { orderNumber: number }) => o.orderNumber)).toEqual([7004, 7003]); // جدیدترین اول
    expect(p3.body.data.data.map((o: { orderNumber: number }) => o.orderNumber)).toEqual([7000]);
  });

  it("16b) بازه تاریخ بر اساس روز تهران (آفست +03:30) و شامل روز پایان", async () => {
    const o1 = fake.addOrder({ orderNumber: 8001 });
    const o2 = fake.addOrder({ orderNumber: 8002 });
    const o3 = fake.addOrder({ orderNumber: 8003 });
    // ۲۰:۲۹:۵۹Z = ۲۳:۵۹:۵۹ تهران، ۹ اکتبر | ۲۰:۳۰:۰۰Z = ۰۰:۰۰ تهران، ۱۰ اکتبر
    fake.addSellerOrder(o1, sellerA, { createdAt: T("2026-10-09T20:29:59Z") });
    fake.addSellerOrder(o2, sellerA, { createdAt: T("2026-10-09T20:30:00Z") });
    fake.addSellerOrder(o3, sellerA, { createdAt: T("2026-10-10T20:29:59Z") }); // ۱۰ اکتبر، ۲۳:۵۹:۵۹ تهران

    const numbers = async (query: string) =>
      (await request(app).get(url(`?${query}`)).set(asA())).body.data.data
        .map((o: { orderNumber: number }) => o.orderNumber)
        .sort();
    expect(await numbers("from=2026-10-10")).toEqual([8002, 8003]);
    expect(await numbers("to=2026-10-09")).toEqual([8001]);
    expect(await numbers("from=2026-10-10&to=2026-10-10")).toEqual([8002, 8003]);
    expect(await numbers("from=2026-10-09&to=2026-10-10")).toEqual([8001, 8002, 8003]);
  });

  it("16c) پارامترهای نامعتبر → 400", async () => {
    for (const query of [
      "status=BAD",
      "page=0",
      "limit=500",
      "q=abc",
      "q=12345678901234567890123",
      "from=2026-13-01",
      "to=2026-02-31",
      "from=hello",
      "from=2026-10-10&to=2026-10-01",
    ]) {
      expect((await request(app).get(url(`?${query}`)).set(asA())).status, query).toBe(400);
    }
  });

  it("17) خلاصه: شمارش و جمع هر وضعیت، صفرها پر می‌شوند و سفارش‌های پرداخت‌نشده/فروشنده دیگر حساب نمی‌شوند", async () => {
    const add = (status: "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED", seller = sellerA, orderStatus: "PAID" | "PENDING" = "PAID") =>
      fake.addSellerOrder(fake.addOrder({ status: orderStatus }), seller, { status });
    add("PENDING");
    add("PENDING");
    add("PROCESSING");
    add("DELIVERED");
    add("PENDING", sellerA, "PENDING"); // پرداخت‌نشده
    add("SHIPPED", sellerB); // فروشنده دیگر

    const res = await request(app).get(url("/summary")).set(asA());
    expect(res.status).toBe(200);
    expect(res.body.data.totalOrders).toBe(4);
    expect(res.body.data.byStatus).toEqual({
      PENDING: { count: 2, total: 2_000_000 },
      PROCESSING: { count: 1, total: 1_000_000 },
      SHIPPED: { count: 0, total: 0 },
      DELIVERED: { count: 1, total: 1_000_000 },
      CANCELLED: { count: 0, total: 0 },
    });
  });

  it("18) شناسه نامعتبر → 400 و ناموجود → 404", async () => {
    expect((await request(app).get(url("/abc")).set(asA())).status).toBe(400);
    expect((await request(app).get(url(`/${MISSING}`)).set(asA())).status).toBe(404);
    expect((await patch(MISSING, { status: "PROCESSING" })).status).toBe(404);
  });
});
