import express, { type Express } from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../src/middlewares/errorHandler";
import { createAdminController } from "../../src/modules/admin/admin.controller";
import { createRequireAdmin } from "../../src/modules/admin/admin.guard";
import { createAdminRouter } from "../../src/modules/admin/admin.routes";
import { bootstrapAdmin, type BootstrapStore } from "../../src/modules/admin/admin.bootstrap";
import { createAdminCategoriesService } from "../../src/modules/admin/adminCategories.service";
import { createAdminDashboardService } from "../../src/modules/admin/adminDashboard.service";
import { createAdminOrdersService } from "../../src/modules/admin/adminOrders.service";
import { createAdminProductsService } from "../../src/modules/admin/adminProducts.service";
import { createAdminSellersService } from "../../src/modules/admin/adminSellers.service";
import { createCartService } from "../../src/modules/cart/cart.service";
import { toCartSummary } from "../../src/modules/cart/cart.mapper";
import type { CartRepository } from "../../src/modules/cart/cart.repository";
import { signAccessToken } from "../../src/utils/tokens";
import { createFakeAdminWorld } from "../helpers/fakeAdminState";

vi.hoisted(() => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
  process.env.JWT_ACCESS_SECRET ??= "test-access-secret-test-access-secret-1234";
  process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-test-refresh-secret-123";
  process.env.CORS_ORIGIN ??= "http://localhost:3000";
});

const MISSING = "00000000-0000-4000-8000-999999999999";

let world: ReturnType<typeof createFakeAdminWorld>;
let app: Express;
let adminId: string;
let customerId: string;
let sellerUserId: string;

const tokenFor = (userId: string, role: "CUSTOMER" | "SELLER" | "ADMIN") => ({
  Authorization: `Bearer ${signAccessToken({ userId, role })}`,
});
const asAdmin = () => tokenFor(adminId, "ADMIN");

function buildApp(): Express {
  const r = world.repositories;
  const controller = createAdminController({
    dashboard: createAdminDashboardService(r.dashboard),
    sellers: createAdminSellersService(r.sellers),
    products: createAdminProductsService(r.products),
    categories: createAdminCategoriesService(r.categories),
    orders: createAdminOrdersService(r.orders),
  });
  const a = express();
  a.use(express.json());
  a.use("/api/admin", createAdminRouter(controller, createRequireAdmin(world.findUserRole)));
  a.use(errorHandler);
  return a;
}

beforeEach(() => {
  world = createFakeAdminWorld();
  adminId = world.addUser("ADMIN", "مدیر");
  customerId = world.addUser("CUSTOMER", "مشتری");
  sellerUserId = world.addUser("SELLER", "فروشنده");
  app = buildApp();
});

describe("دسترسی ادمین", () => {
  const endpoints: [string, string][] = [
    ["get", "/api/admin/dashboard"],
    ["get", "/api/admin/sellers"],
    ["get", `/api/admin/sellers/${MISSING}`],
    ["patch", `/api/admin/sellers/${MISSING}/status`],
    ["get", "/api/admin/products"],
    ["get", `/api/admin/products/${MISSING}`],
    ["patch", `/api/admin/products/${MISSING}/status`],
    ["get", "/api/admin/categories"],
    ["post", "/api/admin/categories"],
    ["patch", `/api/admin/categories/${MISSING}`],
    ["delete", `/api/admin/categories/${MISSING}`],
    ["get", "/api/admin/orders"],
    ["get", `/api/admin/orders/${MISSING}`],
  ];
  const call = (method: string, url: string, headers: Record<string, string> = {}) =>
    (request(app) as unknown as Record<string, (u: string) => request.Test>)[method]!(url).set(headers).send({});

  it("کاربر ناشناس روی همهٔ مسیرها ۴۰۱ می‌گیرد", async () => {
    for (const [m, u] of endpoints) expect((await call(m, u)).status, `${m} ${u}`).toBe(401);
  });

  it("مشتری و فروشندهٔ عادی روی همهٔ مسیرها ۴۰۳ می‌گیرند (حتی با بدنهٔ نامعتبر)", async () => {
    for (const headers of [tokenFor(customerId, "CUSTOMER"), tokenFor(sellerUserId, "SELLER")]) {
      for (const [m, u] of endpoints) {
        const res = await call(m, u, headers);
        expect(res.status, `${m} ${u}`).toBe(403);
        expect(res.body.success).toBe(false);
      }
    }
  });

  it("توکنِ جعلی با ادعای ADMIN وقتی نقش دیتابیس CUSTOMER است ۴۰۳ می‌گیرد", async () => {
    const res = await request(app).get("/api/admin/dashboard").set(tokenFor(customerId, "ADMIN"));
    expect(res.status).toBe(403);
  });

  it("ادمینِ دیتابیس با توکن قدیمیِ CUSTOMER دسترسی دارد (نقش از DB خوانده می‌شود)", async () => {
    const res = await request(app).get("/api/admin/dashboard").set(tokenFor(adminId, "CUSTOMER"));
    expect(res.status).toBe(200);
  });

  it("ادمینِ عزل‌شده بلافاصله ۴۰۳ می‌گیرد و کاربر حذف‌شده ۴۰۱", async () => {
    world.users.get(adminId)!.role = "CUSTOMER";
    expect((await request(app).get("/api/admin/dashboard").set(asAdmin())).status).toBe(403);
    world.users.delete(adminId);
    expect((await request(app).get("/api/admin/dashboard").set(asAdmin())).status).toBe(401);
  });

  it("هیچ پاسخی passwordHash نشت نمی‌دهد", async () => {
    const { sellerId } = world.addSeller("PENDING", "الف");
    const orderUser = world.addUser();
    const orderId = world.addOrder({ userId: orderUser });
    for (const url of [
      "/api/admin/dashboard",
      "/api/admin/sellers",
      `/api/admin/sellers/${sellerId}`,
      "/api/admin/orders",
      `/api/admin/orders/${orderId}`,
    ]) {
      const res = await request(app).get(url).set(asAdmin());
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body).toLowerCase()).not.toContain("password");
    }
  });
});

describe("داشبورد", () => {
  it("شمارش‌ها را درست می‌دهد و درآمد ندارد", async () => {
    world.addUser("CUSTOMER");
    const a = world.addSeller("PENDING", "الف");
    const b = world.addSeller("APPROVED", "ب");
    world.addSeller("SUSPENDED", "ج");
    const cat = world.addCategory("کت", "coat");
    world.addProduct({ sellerId: b.sellerId, categoryId: cat });
    world.addProduct({ sellerId: b.sellerId, categoryId: cat, status: "DRAFT" });
    world.addOrder({ userId: customerId, status: "PAID" });
    world.addOrder({ userId: customerId });
    void a;

    const res = await request(app).get("/api/admin/dashboard").set(asAdmin());
    expect(res.status).toBe(200);
    const d = res.body.data;
    // مشتری‌ها: customerId + کاربر بالا + مالکان PENDING/APPROVED/SUSPENDED که نقش CUSTOMER دارند
    expect(d.customers).toBe(5);
    expect(d.sellers).toMatchObject({ PENDING: 1, APPROVED: 1, SUSPENDED: 1, REJECTED: 0 });
    expect(d.pendingSellerApplications).toBe(1);
    expect(d.products).toMatchObject({ PUBLISHED: 1, DRAFT: 1, ARCHIVED: 0 });
    expect(d.orders).toMatchObject({ PAID: 1, PENDING: 1 });
    expect(d.recentOrders).toHaveLength(2);
    expect(Object.keys(d).join()).not.toMatch(/revenue|sales/i);
  });
});

describe("فروشنده‌ها", () => {
  it("لیست با جست‌وجو، فیلتر وضعیت و صفحه‌بندی", async () => {
    for (let i = 0; i < 5; i += 1) world.addSeller("PENDING", `بوتیک${i}`);
    world.addSeller("APPROVED", "گالری");
    const all = await request(app).get("/api/admin/sellers?limit=4&page=2").set(asAdmin());
    expect(all.body.data.pagination.total).toBe(6);
    expect(all.body.data.data).toHaveLength(2);
    const pending = await request(app).get("/api/admin/sellers?status=PENDING").set(asAdmin());
    expect(pending.body.data.pagination.total).toBe(5);
    const q = await request(app).get(`/api/admin/sellers?q=${encodeURIComponent("گالری")}`).set(asAdmin());
    expect(q.body.data.pagination.total).toBe(1);
    expect((await request(app).get("/api/admin/sellers?status=BOGUS").set(asAdmin())).status).toBe(400);
  });

  it("جزئیات: مالک، شمار محصولات و تاریخچه؛ ۴۰۴ و ۴۰۰", async () => {
    const { sellerId } = world.addSeller("PENDING", "الف");
    const res = await request(app).get(`/api/admin/sellers/${sellerId}`).set(asAdmin());
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(sellerId);
    expect(res.body.data.owner.email).toBeTruthy();
    expect((await request(app).get(`/api/admin/sellers/${MISSING}`).set(asAdmin())).status).toBe(404);
    expect((await request(app).get("/api/admin/sellers/not-a-uuid").set(asAdmin())).status).toBe(400);
  });

  const patch = (id: string, body: unknown) =>
    request(app).patch(`/api/admin/sellers/${id}/status`).set(asAdmin()).send(body as object);

  it("تأیید: نقش مالک CUSTOMER→SELLER می‌شود و ممیزی با هویت ادمین از توکن ثبت می‌شود", async () => {
    const { sellerId, userId } = world.addSeller("PENDING", "الف");
    const res = await patch(sellerId, { status: "APPROVED" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("APPROVED");
    expect(world.users.get(userId)!.role).toBe("SELLER");
    expect(world.audit).toHaveLength(1);
    expect(world.audit[0]).toMatchObject({
      adminId,
      action: "SELLER_STATUS_CHANGED",
      targetId: sellerId,
      fromStatus: "PENDING",
      toStatus: "APPROVED",
    });
  });

  it("رد و تعلیق بدون دلیل ۴۰۰؛ با دلیل موفق و دلیل ثبت می‌شود", async () => {
    const a = world.addSeller("PENDING", "الف");
    expect((await patch(a.sellerId, { status: "REJECTED" })).status).toBe(400);
    expect((await patch(a.sellerId, { status: "REJECTED", reason: "  " })).status).toBe(400);
    const ok = await patch(a.sellerId, { status: "REJECTED", reason: "مدارک ناقص است" });
    expect(ok.status).toBe(200);
    expect(world.sellers.get(a.sellerId)!.statusReason).toBe("مدارک ناقص است");
    expect(world.audit[0]!.reason).toBe("مدارک ناقص است");

    const b = world.addSeller("APPROVED", "ب");
    expect((await patch(b.sellerId, { status: "SUSPENDED" })).status).toBe(400);
    expect((await patch(b.sellerId, { status: "SUSPENDED", reason: "شکایت مشتریان" })).status).toBe(200);
  });

  it("فعال‌سازی مجدد دلیل را پاک می‌کند", async () => {
    const { sellerId } = world.addSeller("APPROVED", "الف");
    await patch(sellerId, { status: "SUSPENDED", reason: "تخلف" });
    const res = await patch(sellerId, { status: "APPROVED" });
    expect(res.status).toBe(200);
    expect(world.sellers.get(sellerId)!.statusReason).toBeNull();
    expect(world.audit).toHaveLength(2);
  });

  it("گذارهای نامعتبر ۴۰۹؛ ردشده پایانی است", async () => {
    const pending = world.addSeller("PENDING", "الف");
    expect((await patch(pending.sellerId, { status: "SUSPENDED", reason: "xxx" })).status).toBe(409);
    const approved = world.addSeller("APPROVED", "ب");
    expect((await patch(approved.sellerId, { status: "APPROVED" })).status).toBe(409);
    expect((await patch(approved.sellerId, { status: "REJECTED", reason: "xxx" })).status).toBe(409);
    const rejected = world.addSeller("REJECTED", "ج");
    expect((await patch(rejected.sellerId, { status: "APPROVED" })).status).toBe(409);
    expect(world.audit).toHaveLength(0);
  });

  it("بدنهٔ strict: adminId/actorId/نقش پذیرفته نمی‌شود", async () => {
    const { sellerId } = world.addSeller("PENDING", "الف");
    expect((await patch(sellerId, { status: "APPROVED", adminId: randomUUID() })).status).toBe(400);
    expect((await patch(sellerId, { status: "APPROVED", actorId: randomUUID() })).status).toBe(400);
    expect((await patch(sellerId, { status: "APPROVED", role: "ADMIN" })).status).toBe(400);
    expect((await patch(sellerId, { status: "PENDING" })).status).toBe(400);
    expect((await patch(MISSING, { status: "APPROVED" })).status).toBe(404);
  });

  it("خطای ممیزی کل تغییر (وضعیت + نقش) را برمی‌گرداند", async () => {
    const { sellerId, userId } = world.addSeller("PENDING", "الف");
    world.faults.failAudit = true;
    const res = await patch(sellerId, { status: "APPROVED" });
    expect(res.status).toBe(500);
    expect(world.sellers.get(sellerId)!.status).toBe("PENDING");
    expect(world.users.get(userId)!.role).toBe("CUSTOMER");
    expect(world.audit).toHaveLength(0);
  });

  it("تأیید و رد همزمان: دقیقاً یکی برنده است", async () => {
    const { sellerId } = world.addSeller("PENDING", "الف");
    const [x, y] = await Promise.all([
      patch(sellerId, { status: "APPROVED" }),
      patch(sellerId, { status: "REJECTED", reason: "دلیل" }),
    ]);
    expect([x.status, y.status].sort()).toEqual([200, 409]);
    expect(world.audit).toHaveLength(1);
  });

  it("دو تأیید همزمان: یکی ۲۰۰ و دیگری ۴۰۹", async () => {
    const { sellerId } = world.addSeller("PENDING", "الف");
    const [x, y] = await Promise.all([patch(sellerId, { status: "APPROVED" }), patch(sellerId, { status: "APPROVED" })]);
    expect([x.status, y.status].sort()).toEqual([200, 409]);
    expect(world.audit).toHaveLength(1);
  });

  it("نقش ADMIN مالک هنگام تأیید پایین‌تر نمی‌آید", async () => {
    const { sellerId, userId } = world.addSeller("PENDING", "الف", "ADMIN");
    await patch(sellerId, { status: "APPROVED" });
    expect(world.users.get(userId)!.role).toBe("ADMIN");
  });
});

describe("محصولات", () => {
  let cat: string;
  let approved: { sellerId: string; userId: string };
  let suspended: { sellerId: string; userId: string };
  beforeEach(() => {
    cat = world.addCategory("کت", "coat");
    approved = world.addSeller("APPROVED", "الف");
    suspended = world.addSeller("SUSPENDED", "ب");
  });
  const patch = (id: string, body: unknown) =>
    request(app).patch(`/api/admin/products/${id}/status`).set(asAdmin()).send(body as object);

  it("فیلترها، sellerBlocked و totalStock", async () => {
    const cat2 = world.addCategory("شلوار", "pants");
    const p1 = world.addProduct({ sellerId: approved.sellerId, categoryId: cat, title: "کت پشمی", stocks: [2, 3] });
    const p2 = world.addProduct({ sellerId: suspended.sellerId, categoryId: cat2, title: "شلوار", status: "DRAFT" });
    const list = await request(app).get("/api/admin/products").set(asAdmin());
    expect(list.body.data.pagination.total).toBe(2);
    const row1 = list.body.data.data.find((i: { id: string }) => i.id === p1);
    expect(row1.totalStock).toBe(5);
    expect(row1.sellerBlocked).toBe(false);
    expect(list.body.data.data.find((i: { id: string }) => i.id === p2).sellerBlocked).toBe(true);

    const by = async (qs: string) => (await request(app).get(`/api/admin/products?${qs}`).set(asAdmin())).body.data.pagination.total;
    expect(await by("status=DRAFT")).toBe(1);
    expect(await by(`categoryId=${cat}`)).toBe(1);
    expect(await by(`sellerId=${suspended.sellerId}`)).toBe(1);
    expect(await by("blockedSellers=true")).toBe(1);
    expect(await by("blockedSellers=false")).toBe(1);
    expect(await by(`q=${encodeURIComponent("پشمی")}`)).toBe(1);
  });

  it("جزئیات شامل تنوع‌ها، تصویر و موجودی", async () => {
    const p = world.addProduct({ sellerId: approved.sellerId, categoryId: cat, stocks: [4] });
    const res = await request(app).get(`/api/admin/products/${p}`).set(asAdmin());
    expect(res.status).toBe(200);
    expect(res.body.data.variants[0].stock).toBe(4);
    expect(res.body.data.images).toHaveLength(1);
    expect((await request(app).get(`/api/admin/products/${MISSING}`).set(asAdmin())).status).toBe(404);
  });

  it("لغو انتشار/آرشیو با دلیل و ممیزی؛ موجودی و تنوع‌ها دست‌نخورده", async () => {
    const p = world.addProduct({ sellerId: approved.sellerId, categoryId: cat, stocks: [4, 6] });
    const before = JSON.stringify(world.products.get(p)!.variants);
    const res = await patch(p, { status: "DRAFT", reason: "تصویر نامناسب" });
    expect(res.status).toBe(200);
    expect(world.products.get(p)!.status).toBe("DRAFT");
    expect(world.audit[0]).toMatchObject({ adminId, action: "PRODUCT_STATUS_CHANGED", fromStatus: "PUBLISHED", toStatus: "DRAFT" });
    expect((await patch(p, { status: "ARCHIVED", reason: "تخلف" })).status).toBe(200);
    expect(JSON.stringify(world.products.get(p)!.variants)).toBe(before);
  });

  it("ARCHIVED پایانی است (۴۰۹)؛ دلیل لازم است؛ هدف PUBLISHED مجاز نیست", async () => {
    const p = world.addProduct({ sellerId: approved.sellerId, categoryId: cat, status: "ARCHIVED" });
    expect((await patch(p, { status: "DRAFT", reason: "دلیل" })).status).toBe(409);
    const q = world.addProduct({ sellerId: approved.sellerId, categoryId: cat });
    expect((await patch(q, { status: "DRAFT" })).status).toBe(400);
    expect((await patch(q, { status: "PUBLISHED", reason: "دلیل" })).status).toBe(400);
    expect((await patch(MISSING, { status: "DRAFT", reason: "دلیل" })).status).toBe(404);
  });

  it("بدنهٔ strict: sellerId و stock پذیرفته نمی‌شود", async () => {
    const p = world.addProduct({ sellerId: approved.sellerId, categoryId: cat });
    expect((await patch(p, { status: "DRAFT", reason: "دلیل", sellerId: randomUUID() })).status).toBe(400);
    expect((await patch(p, { status: "DRAFT", reason: "دلیل", stock: 0 })).status).toBe(400);
  });

  it("خطای ممیزی وضعیت را برمی‌گرداند", async () => {
    const p = world.addProduct({ sellerId: approved.sellerId, categoryId: cat });
    world.faults.failAudit = true;
    expect((await patch(p, { status: "DRAFT", reason: "دلیل" })).status).toBe(500);
    expect(world.products.get(p)!.status).toBe("PUBLISHED");
  });
});

describe("تعلیق فروشنده روی سبد خرید", () => {
  const variant = (sellerStatus: string) => ({
    id: "v1",
    stock: 5,
    isActive: true,
    product: { status: "PUBLISHED", seller: { status: sellerStatus } },
  });
  const repo = (sellerStatus: string): CartRepository => ({
    findVariantForCart: async () => variant(sellerStatus),
    getItems: async () => [],
    getItemQuantity: async () => 0,
    upsertItem: async () => undefined,
    removeItem: async () => undefined,
  });

  it("افزودن کالای فروشندهٔ تعلیق‌شده ۴۰۴ می‌دهد؛ فروشندهٔ تأییدشده موفق است", async () => {
    await expect(createCartService(repo("SUSPENDED")).addItem("u", "v1", 1)).rejects.toMatchObject({ statusCode: 404 });
    await expect(createCartService(repo("APPROVED")).addItem("u", "v1", 1)).resolves.toBeDefined();
  });

  it("mapper: isAvailable برای فروشندهٔ تعلیق‌شده false است", () => {
    const row = (status: string) => ({
      quantity: 1,
      variant: {
        id: "v1",
        size: "M",
        color: "مشکی",
        price: null,
        stock: 5,
        product: { id: "p", slug: "s", title: "t", basePrice: 100, status: "PUBLISHED", images: [], seller: { status } },
      },
    });
    expect(toCartSummary([row("SUSPENDED")]).items[0]!.isAvailable).toBe(false);
    expect(toCartSummary([row("APPROVED")]).items[0]!.isAvailable).toBe(true);
  });
});

describe("دسته‌بندی‌ها", () => {
  const post = (body: unknown) => request(app).post("/api/admin/categories").set(asAdmin()).send(body as object);
  const patch = (id: string, body: unknown) =>
    request(app).patch(`/api/admin/categories/${id}`).set(asAdmin()).send(body as object);
  const del = (id: string) => request(app).delete(`/api/admin/categories/${id}`).set(asAdmin());

  it("لیست با شمارش محصول، جست‌وجو و مرتب‌سازی", async () => {
    const a = world.addCategory("لباس", "clothes");
    const b = world.addCategory("کفش", "shoes");
    const s = world.addSeller("APPROVED", "الف");
    world.addProduct({ sellerId: s.sellerId, categoryId: b });
    world.addProduct({ sellerId: s.sellerId, categoryId: b });
    const all = await request(app).get("/api/admin/categories?sort=products").set(asAdmin());
    expect(all.body.data[0]).toMatchObject({ id: b, productCount: 2 });
    const q = await request(app).get(`/api/admin/categories?q=${encodeURIComponent("لباس")}`).set(asAdmin());
    expect(q.body.data.map((c: { id: string }) => c.id)).toEqual([a]);
  });

  it("ساخت (۲۰۱ + ممیزی)، slug تکراری ۴۰۹ با details.slug، slug نامعتبر و والد ناموجود ۴۰۰", async () => {
    const ok = await post({ name: "کیف", slug: "bags" });
    expect(ok.status).toBe(201);
    expect(world.audit[0]).toMatchObject({ adminId, action: "CATEGORY_CREATED", targetId: ok.body.data.id });
    const dup = await post({ name: "کیف۲", slug: "bags" });
    expect(dup.status).toBe(409);
    expect(dup.body.error.details.slug).toBeTruthy();
    expect((await post({ name: "x", slug: "Bad Slug!" })).status).toBe(400);
    const orphan = await post({ name: "x", slug: "orphan", parentId: MISSING });
    expect(orphan.status).toBe(400);
    expect(orphan.body.error.details.parentId).toBeTruthy();
    expect((await post({ name: "x", slug: "extra", adminId })).status).toBe(400);
  });

  it("ویرایش و ممیزی تغییرات؛ ۴۰۴ و بدنهٔ خالی ۴۰۰", async () => {
    const id = world.addCategory("لباس", "clothes");
    const res = await patch(id, { name: "پوشاک", sortOrder: 3 });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("پوشاک");
    expect(world.audit[0]!.details).toMatchObject({ changes: { name: { from: "لباس", to: "پوشاک" } } });
    expect((await patch(id, {})).status).toBe(400);
    expect((await patch(MISSING, { name: "x" })).status).toBe(404);
  });

  it("والد خودش یا زیرمجموعه‌اش (حلقه) ۴۰۰ است", async () => {
    const a = world.addCategory("الف", "a");
    const b = world.addCategory("ب", "b", a);
    const c = world.addCategory("ج", "c", b);
    expect((await patch(a, { parentId: a })).status).toBe(400);
    expect((await patch(a, { parentId: c })).status).toBe(400);
    expect((await patch(c, { parentId: null })).status).toBe(200);
  });

  it("جابه‌جایی‌های متقابل همزمان حلقه نمی‌سازند", async () => {
    const a = world.addCategory("الف", "a");
    const b = world.addCategory("ب", "b");
    const [x, y] = await Promise.all([patch(a, { parentId: b }), patch(b, { parentId: a })]);
    expect([x.status, y.status].sort()).toEqual([200, 400]);
    const parents = [world.categories.get(a)!.parentId, world.categories.get(b)!.parentId];
    expect(parents.filter(Boolean)).toHaveLength(1);
  });

  it("غیرفعال‌سازی با محصول منتشرشده یا زیردستهٔ فعال ۴۰۹؛ بدون آن‌ها موفق", async () => {
    const s = world.addSeller("APPROVED", "الف");
    const withProduct = world.addCategory("الف", "a");
    world.addProduct({ sellerId: s.sellerId, categoryId: withProduct });
    expect((await patch(withProduct, { isActive: false })).status).toBe(409);
    const parent = world.addCategory("پدر", "p");
    world.addCategory("فرزند", "kid", parent, true);
    expect((await patch(parent, { isActive: false })).status).toBe(409);
    const draftOnly = world.addCategory("پیش‌نویس", "d");
    world.addProduct({ sellerId: s.sellerId, categoryId: draftOnly, status: "DRAFT" });
    expect((await patch(draftOnly, { isActive: false })).status).toBe(200);
  });

  it("حذف: با محصول یا زیردسته ۴۰۹؛ خالی ۲۰۰ + ممیزی؛ ناموجود ۴۰۴", async () => {
    const s = world.addSeller("APPROVED", "الف");
    const used = world.addCategory("پراستفاده", "used");
    world.addProduct({ sellerId: s.sellerId, categoryId: used, status: "ARCHIVED" });
    expect((await del(used)).status).toBe(409);
    const parent = world.addCategory("پدر", "p");
    world.addCategory("فرزند", "kid", parent, false);
    expect((await del(parent)).status).toBe(409);
    const empty = world.addCategory("خالی", "empty");
    expect((await del(empty)).status).toBe(200);
    expect(world.categories.has(empty)).toBe(false);
    expect(world.audit.at(-1)).toMatchObject({ action: "CATEGORY_DELETED", targetId: empty });
    expect((await del(MISSING)).status).toBe(404);
  });

  it("خطای ممیزی ساخت/ویرایش/حذف را برمی‌گرداند", async () => {
    const id = world.addCategory("لباس", "clothes");
    world.faults.failAudit = true;
    expect((await post({ name: "جدید", slug: "new" })).status).toBe(500);
    expect([...world.categories.values()].some((c) => c.slug === "new")).toBe(false);
    expect((await patch(id, { name: "تغییر" })).status).toBe(500);
    expect(world.categories.get(id)!.name).toBe("لباس");
    expect((await del(id)).status).toBe(500);
    expect(world.categories.has(id)).toBe(true);
  });
});

describe("سفارش‌ها (فقط‌خواندنی)", () => {
  it("صفحه‌بندی و فیلتر وضعیت", async () => {
    for (let i = 0; i < 5; i += 1) world.addOrder({ userId: customerId, status: i < 2 ? "PAID" : "PENDING" });
    const page = await request(app).get("/api/admin/orders?limit=2&page=3").set(asAdmin());
    expect(page.body.data.pagination.total).toBe(5);
    expect(page.body.data.data).toHaveLength(1);
    const paid = await request(app).get("/api/admin/orders?status=PAID").set(asAdmin());
    expect(paid.body.data.pagination.total).toBe(2);
  });

  it("فیلتر تاریخ با مرز روز تهران (۲۰:۴۵Z = ۱۱ مهر تهران)", async () => {
    world.addOrder({ userId: customerId, createdAt: new Date("2026-10-10T20:45:00Z") });
    const hit = await request(app).get("/api/admin/orders?from=2026-10-11&to=2026-10-11").set(asAdmin());
    expect(hit.body.data.pagination.total).toBe(1);
    const miss = await request(app).get("/api/admin/orders?from=2026-10-10&to=2026-10-10").set(asAdmin());
    expect(miss.body.data.pagination.total).toBe(0);
    expect((await request(app).get("/api/admin/orders?from=2026-10-12&to=2026-10-10").set(asAdmin())).status).toBe(400);
  });

  it("جست‌وجو با شماره، #شماره و uuid؛ متن نامربوط خالی", async () => {
    const id = world.addOrder({ userId: customerId });
    const num = world.orders.find((o) => o.id === id)!.orderNumber;
    const n = async (q: string) => (await request(app).get(`/api/admin/orders?q=${encodeURIComponent(q)}`).set(asAdmin())).body.data.pagination.total;
    expect(await n(String(num))).toBe(1);
    expect(await n(`#${num}`)).toBe(1);
    expect(await n(id)).toBe(1);
    expect(await n("سلام")).toBe(0);
  });

  it("جزئیات: مشتری، سفارش‌های فروشنده و اقلام؛ ۴۰۴", async () => {
    world.addSeller("APPROVED", "الف");
    const id = world.addOrder({ userId: customerId, sellerStatuses: ["PENDING", "SHIPPED"] });
    const res = await request(app).get(`/api/admin/orders/${id}`).set(asAdmin());
    expect(res.status).toBe(200);
    expect(res.body.data.customer.email).toBeTruthy();
    expect(res.body.data.sellerOrders).toHaveLength(2);
    expect(res.body.data.sellerOrders[0].items[0].lineTotal).toBe(500_000);
    expect((await request(app).get(`/api/admin/orders/${MISSING}`).set(asAdmin())).status).toBe(404);
  });

  it("هیچ مسیر نوشتنی برای سفارش وجود ندارد", async () => {
    const id = world.addOrder({ userId: customerId });
    for (const m of ["patch", "post", "put", "delete"] as const) {
      const res = await (request(app)[m] as (u: string) => request.Test)(`/api/admin/orders/${id}`).set(asAdmin()).send({ status: "PAID" });
      expect(res.status, m).toBe(404);
    }
    expect(world.orders[0]!.status).toBe("PENDING");
  });
});

describe("Bootstrap ادمین", () => {
  const hash = async (p: string) => `hashed:${p.length}`;
  function store(existing: { id: string; role: string } | null = null) {
    const calls = { created: [] as unknown[], promoted: [] as string[] };
    const s: BootstrapStore = {
      findUserByEmail: async () => existing,
      createAdmin: async (d) => void calls.created.push(d),
      promoteToAdmin: async (id) => void calls.promoted.push(id),
    };
    return { s, calls };
  }

  it("ساخت کاربر جدید با رمز هش‌شده (نه متن ساده)", async () => {
    const { s, calls } = store();
    expect(await bootstrapAdmin(s, { email: " Admin@Example.com ", password: "a-very-long-pass" }, hash)).toBe("created");
    expect(calls.created[0]).toMatchObject({ email: "admin@example.com", passwordHash: "hashed:16" });
    expect(JSON.stringify(calls.created)).not.toContain("a-very-long-pass");
  });

  it("ارتقای کاربر موجود بدون دست‌زدن به رمز؛ ادمین موجود بدون تغییر", async () => {
    const a = store({ id: "u1", role: "CUSTOMER" });
    expect(await bootstrapAdmin(a.s, { email: "a@b.co" }, hash)).toBe("promoted");
    expect(a.calls.promoted).toEqual(["u1"]);
    expect(a.calls.created).toHaveLength(0);
    const b = store({ id: "u2", role: "ADMIN" });
    expect(await bootstrapAdmin(b.s, { email: "a@b.co" }, hash)).toBe("already_admin");
    expect(b.calls.promoted).toHaveLength(0);
  });

  it("رمز کوتاه/ایمیل نامعتبر رد می‌شود", async () => {
    const { s, calls } = store();
    await expect(bootstrapAdmin(s, { email: "a@b.co", password: "short" }, hash)).rejects.toMatchObject({ statusCode: 400 });
    await expect(bootstrapAdmin(s, { email: "nope", password: "a-very-long-pass" }, hash)).rejects.toMatchObject({ statusCode: 400 });
    expect(calls.created).toHaveLength(0);
  });
});
