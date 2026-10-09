import express, { type Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../src/middlewares/errorHandler";
import { createVariantsController } from "../../src/modules/variants/variants.controller";
import { createVariantsRouter } from "../../src/modules/variants/variants.routes";
import { createVariantsService } from "../../src/modules/variants/variants.service";
import { signAccessToken } from "../../src/utils/tokens";
import { createFakeVariantsRepository } from "../helpers/fakeVariantsRepository";

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
let fake: ReturnType<typeof createFakeVariantsRepository>;
let sellerA: string;
let sellerB: string;
let productA: string;
let productB: string;

const auth = (userId: string, role: "CUSTOMER" | "SELLER" | "ADMIN" = "SELLER") =>
  `Bearer ${signAccessToken({ userId, role })}`;
const base = (productId: string) => `/api/seller/products/${productId}/variants`;
const asA = { Authorization: "" };

beforeEach(() => {
  fake = createFakeVariantsRepository();
  sellerA = fake.addSeller(USER_A, "APPROVED");
  sellerB = fake.addSeller(USER_B, "APPROVED");
  fake.addSeller(PENDING_USER, "PENDING");
  productA = fake.addProduct(sellerA);
  productB = fake.addProduct(sellerB);
  asA.Authorization = auth(USER_A);

  app = express();
  app.use(express.json());
  app.use(
    "/api/seller/products/:productId/variants",
    createVariantsRouter(createVariantsController(createVariantsService(fake.repository))),
  );
  app.use(errorHandler);
});

describe("دسترسی", () => {
  it("1) بدون احراز هویت → 401", async () => {
    expect((await request(app).get(base(productA))).status).toBe(401);
  });

  it("2) مشتری → 403 (حتی با بدنه نامعتبر؛ پیام اعتبارسنجی فاش نمی‌شود)", async () => {
    const res = await request(app).post(base(productA)).set("Authorization", auth(CUSTOMER, "CUSTOMER")).send({});
    expect(res.status).toBe(403);
  });

  it("3) فروشنده PENDING → 403", async () => {
    const res = await request(app).get(base(productA)).set("Authorization", auth(PENDING_USER));
    expect(res.status).toBe(403);
  });

  it("4) فروشنده APPROVED مجاز است (حتی با توکن کهنه نقش CUSTOMER)", async () => {
    fake.addVariant(productA, { size: "M", color: "مشکی", sku: "TS-BLK-M", stock: 4 });
    const res = await request(app).get(base(productA)).set("Authorization", auth(USER_A, "CUSTOMER"));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ sku: "TS-BLK-M", isActive: true, stock: 4 });
  });
});

describe("ساخت تنوع", () => {
  it("5) تنوع معتبر ساخته می‌شود؛ سایز نرمال، SKU خودکار و موجودی اولیه در دفتر کل", async () => {
    const res = await request(app).post(base(productA)).set(asA).send({ size: " xl ", color: "  کرم ", stock: 3 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ size: "XL", color: "کرم", stock: 3, price: null, isActive: true });
    expect(res.body.data.sku).toMatch(/^VST-[0-9A-F]{8}$/);
    expect(fake.movements).toEqual([
      expect.objectContaining({ type: "INITIAL", quantityDelta: 3, actorId: USER_A }),
    ]);
  });

  it("5b) SKU سفارشی به حروف بزرگ نرمال می‌شود و قیمت اختصاصی ذخیره می‌شود", async () => {
    const res = await request(app)
      .post(base(productA))
      .set(asA)
      .send({ size: "M", color: "Black", sku: "ts-blk-m", price: 1_200_000 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ sku: "TS-BLK-M", price: 1_200_000 });
  });

  it("5c) sellerId/productId/isActive ارسالی در Body نادیده گرفته می‌شود", async () => {
    const res = await request(app)
      .post(base(productA))
      .set(asA)
      .send({ size: "M", color: "Black", sellerId: sellerB, productId: productB, isActive: false });
    expect(res.status).toBe(201);
    expect(fake.variants[0]?.productId).toBe(productA);
    expect(fake.variants[0]?.isActive).toBe(true);
  });

  it.each([
    ["کوتاه", "A"],
    ["فاصله و کاراکتر غیرمجاز", "TS BLK!"],
    ["فارسی", "کد-۱"],
  ])("6) SKU نامعتبر (%s) → 400 با خطای فیلد sku", async (_label, sku) => {
    const res = await request(app).post(base(productA)).set(asA).send({ size: "M", color: "Black", sku });
    expect(res.status).toBe(400);
    expect(res.body.error.details.sku).toBeDefined();
    expect(fake.variants).toHaveLength(0);
  });

  it("7) SKU تکراری (حتی متعلق به فروشنده دیگر) → 409 بدون فاش‌کردن مالک", async () => {
    fake.addVariant(productB, { size: "M", color: "Black", sku: "TS-BLK-M" });
    const res = await request(app).post(base(productA)).set(asA).send({ size: "M", color: "Black", sku: "TS-BLK-M" });
    expect(res.status).toBe(409);
    expect(res.body.error.details.sku).toBeDefined();
    expect(fake.variants).toHaveLength(1);
  });

  it("8) ترکیب رنگ/سایز تکراری (مستقل از حروف و فاصله) → 409", async () => {
    await request(app).post(base(productA)).set(asA).send({ size: "M", color: "Black" });
    const res = await request(app).post(base(productA)).set(asA).send({ size: " m ", color: "BLACK" });
    expect(res.status).toBe(409);
    expect(res.body.error.details.color).toBeDefined();
    expect(fake.variants).toHaveLength(1);
  });

  it("8b) همان ترکیب برای محصول دیگرِ همان فروشنده مجاز است", async () => {
    const other = fake.addProduct(sellerA);
    await request(app).post(base(productA)).set(asA).send({ size: "M", color: "Black" });
    expect((await request(app).post(base(other)).set(asA).send({ size: "M", color: "Black" })).status).toBe(201);
  });

  it.each([
    ["صفر", 0],
    ["منفی", -5],
    ["اعشاری", 10.5],
    ["رشته", "abc"],
    ["بیش از حد", 5_000_000_000],
  ])("9) قیمت نامعتبر (%s) → 400", async (_label, price) => {
    const res = await request(app).post(base(productA)).set(asA).send({ size: "M", color: "Black", price });
    expect(res.status).toBe(400);
    expect(res.body.error.details.price).toBeDefined();
  });

  it("رنگ/سایز خالی و موجودی منفی → 400", async () => {
    for (const body of [{ size: "", color: "x" }, { size: "M", color: "  " }, { size: "M", color: "x", stock: -1 }]) {
      expect((await request(app).post(base(productA)).set(asA).send(body)).status).toBe(400);
    }
  });

  it("محصول آرشیوشده → 409", async () => {
    const archived = fake.addProduct(sellerA, "ARCHIVED");
    const res = await request(app).post(base(archived)).set(asA).send({ size: "M", color: "Black" });
    expect(res.status).toBe(409);
  });
});

describe("جداسازی فروشندگان", () => {
  it("10) لیست و ساخت روی محصول فروشنده دیگر → 404 و بدون نوشتن", async () => {
    fake.addVariant(productB, { size: "M", color: "Black", sku: "B-1" });
    const list = await request(app).get(base(productB)).set(asA);
    const missing = await request(app).get(base(MISSING)).set(asA);
    const create = await request(app).post(base(productB)).set(asA).send({ size: "L", color: "Red" });
    expect(list.status).toBe(404);
    expect(list.body.error.message).toBe(missing.body.error.message);
    expect(create.status).toBe(404);
    expect(fake.variants).toHaveLength(1);
  });

  it("11) ویرایش تنوع فروشنده دیگر → 404 و بدون تغییر؛ حتی با productId خودی و variantId بیگانه", async () => {
    const foreign = fake.addVariant(productB, { size: "M", color: "Black", sku: "B-1", price: 5000 });
    const viaForeignProduct = await request(app).patch(`${base(productB)}/${foreign}`).set(asA).send({ price: 1 });
    const viaOwnProduct = await request(app).patch(`${base(productA)}/${foreign}`).set(asA).send({ price: 1 });
    expect(viaForeignProduct.status).toBe(404);
    expect(viaOwnProduct.status).toBe(404);
    expect(fake.variants[0]?.price).toBe(5000);
  });

  it("12) آرشیو تنوع فروشنده دیگر → 404 و بدون تغییر", async () => {
    const foreign = fake.addVariant(productB, { size: "M", color: "Black", sku: "B-1" });
    const viaForeignProduct = await request(app).delete(`${base(productB)}/${foreign}`).set(asA);
    const viaOwnProduct = await request(app).delete(`${base(productA)}/${foreign}`).set(asA);
    expect(viaForeignProduct.status).toBe(404);
    expect(viaOwnProduct.status).toBe(404);
    expect(fake.variants[0]?.isActive).toBe(true);
  });

  it("همگام‌سازی روی محصول فروشنده دیگر → 404", async () => {
    const res = await request(app).put(base(productB)).set(asA).send({ variants: [{ size: "M", color: "Black" }] });
    expect(res.status).toBe(404);
    expect(fake.variants).toHaveLength(0);
  });
});

describe("ویرایش و آرشیو", () => {
  it("13) ویرایش SKU، قیمت و رنگ؛ قیمت با null به قیمت پایه برمی‌گردد", async () => {
    const id = fake.addVariant(productA, { size: "M", color: "Black", sku: "OLD-1", price: 900_000 });
    const res = await request(app)
      .patch(`${base(productA)}/${id}`)
      .set(asA)
      .send({ sku: "new-1", color: "Cream", price: null });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ sku: "NEW-1", color: "Cream", price: null });
  });

  it("13b) موجودی از این مسیر قابل تغییر نیست (منبع حقیقت = دفتر کل انبار)", async () => {
    const id = fake.addVariant(productA, { size: "M", color: "Black", sku: "S-1", stock: 7 });
    const res = await request(app).patch(`${base(productA)}/${id}`).set(asA).send({ stock: 999 });
    expect(res.status).toBe(400);
    expect(fake.variants[0]?.stock).toBe(7);
    const mixed = await request(app).patch(`${base(productA)}/${id}`).set(asA).send({ price: 5000, stock: 999 });
    expect(mixed.status).toBe(200);
    expect(fake.variants[0]?.stock).toBe(7);
  });

  it("ویرایش به SKU یا ترکیب موجود → 409؛ نگه‌داشتن SKU خودش مشکلی ندارد", async () => {
    const a = fake.addVariant(productA, { size: "M", color: "Black", sku: "A-1" });
    fake.addVariant(productA, { size: "L", color: "Black", sku: "A-2" });
    expect((await request(app).patch(`${base(productA)}/${a}`).set(asA).send({ sku: "A-2" })).status).toBe(409);
    expect((await request(app).patch(`${base(productA)}/${a}`).set(asA).send({ size: "l" })).status).toBe(409);
    expect((await request(app).patch(`${base(productA)}/${a}`).set(asA).send({ sku: "A-1", price: 5000 })).status).toBe(200);
  });

  it("14) DELETE تنوع را آرشیو می‌کند (حذف فیزیکی نه) و Idempotent است", async () => {
    const id = fake.addVariant(productA, { size: "M", color: "Black", sku: "A-1", stock: 5 });
    const res = await request(app).delete(`${base(productA)}/${id}`).set(asA);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id, isActive: false, stock: 5 });
    expect(fake.variants).toHaveLength(1);
    expect((await request(app).delete(`${base(productA)}/${id}`).set(asA)).status).toBe(200);
    // تنوع آرشیوشده ویرایش نمی‌شود
    expect((await request(app).patch(`${base(productA)}/${id}`).set(asA).send({ price: 1000 })).status).toBe(409);
  });

  it("ساخت دوباره ترکیبِ آرشیوشده، همان رکورد را فعال می‌کند (موجودی و شناسه حفظ می‌شود)", async () => {
    const id = fake.addVariant(productA, { size: "M", color: "Black", sku: "A-1", stock: 5, isActive: false });
    const res = await request(app).post(base(productA)).set(asA).send({ size: "m", color: "black", price: 700_000 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ id, isActive: true, stock: 5, price: 700_000, sku: "A-1" });
    expect(fake.variants).toHaveLength(1);
  });

  it("آرشیو آخرین تنوع فعال محصول منتشرشده → 409", async () => {
    const published = fake.addProduct(sellerA, "PUBLISHED");
    const only = fake.addVariant(published, { size: "M", color: "Black", sku: "P-1" });
    const res = await request(app).delete(`${base(published)}/${only}`).set(asA);
    expect(res.status).toBe(409);
    expect(fake.variants[0]?.isActive).toBe(true);
    fake.addVariant(published, { size: "L", color: "Black", sku: "P-2" });
    expect((await request(app).delete(`${base(published)}/${only}`).set(asA)).status).toBe(200);
  });
});

describe("ذخیره Variant Builder (PUT)", () => {
  const combos = (colors: string[], sizes: string[]) =>
    colors.flatMap((color) => sizes.map((size) => ({ color, size })));

  it("ترکیب‌های جدید ساخته می‌شوند و ذخیره دوباره، رکورد تکراری نمی‌سازد", async () => {
    const body = { variants: combos(["Black", "Cream"], ["S", "M", "L"]) };
    const first = await request(app).put(base(productA)).set(asA).send(body);
    expect(first.status).toBe(200);
    expect(first.body.data).toHaveLength(6);
    const ids = first.body.data.map((v: { id: string }) => v.id).sort();

    const second = await request(app).put(base(productA)).set(asA).send(body);
    expect(second.status).toBe(200);
    expect(fake.variants).toHaveLength(6);
    expect(second.body.data.map((v: { id: string }) => v.id).sort()).toEqual(ids);
    expect(fake.movements).toHaveLength(6); // INITIAL فقط یک‌بار به‌ازای هر ساخت
  });

  it("ویرایش با id، آرشیوِ غایب‌ها و ساخت جدید در یک ذخیره", async () => {
    const keep = fake.addVariant(productA, { size: "M", color: "Black", sku: "K-1", stock: 9 });
    const drop = fake.addVariant(productA, { size: "L", color: "Black", sku: "D-1" });
    const res = await request(app)
      .put(base(productA))
      .set(asA)
      .send({
        variants: [
          { id: keep, size: "M", color: "Black", sku: "K-2", price: 800_000, stock: 12345 },
          { size: "XL", color: "Black" },
        ],
      });
    expect(res.status).toBe(200);
    const byId = new Map(fake.variants.map((v) => [v.id, v]));
    expect(byId.get(keep)).toMatchObject({ sku: "K-2", price: 800_000, stock: 9, isActive: true });
    expect(byId.get(drop)?.isActive).toBe(false);
    expect(fake.variants.filter((v) => v.isActive)).toHaveLength(2);
  });

  it("ترکیب تکراری در همان درخواست → 400؛ SKU تکراری درخواست → 400", async () => {
    const dupCombo = await request(app)
      .put(base(productA))
      .set(asA)
      .send({ variants: [{ size: "M", color: "Black" }, { size: "m", color: "black" }] });
    expect(dupCombo.status).toBe(400);
    const dupSku = await request(app)
      .put(base(productA))
      .set(asA)
      .send({ variants: [{ size: "M", color: "Black", sku: "X-1" }, { size: "L", color: "Black", sku: "x-1" }] });
    expect(dupSku.status).toBe(400);
    expect(fake.variants).toHaveLength(0);
  });

  it("SKU متعلق به تنوع دیگر → 409 و هیچ تغییری اعمال نمی‌شود", async () => {
    fake.addVariant(productB, { size: "M", color: "Black", sku: "B-1" });
    const existing = fake.addVariant(productA, { size: "M", color: "Black", sku: "A-1" });
    const res = await request(app)
      .put(base(productA))
      .set(asA)
      .send({ variants: [{ id: existing, size: "M", color: "Black", sku: "B-1" }, { size: "L", color: "Black" }] });
    expect(res.status).toBe(409);
    expect(fake.variants).toHaveLength(2);
    expect(fake.variants.find((v) => v.id === existing)?.sku).toBe("A-1");
  });

  it("id متعلق به محصول دیگر → 404", async () => {
    const foreign = fake.addVariant(productB, { size: "M", color: "Black", sku: "B-1" });
    const res = await request(app)
      .put(base(productA))
      .set(asA)
      .send({ variants: [{ id: foreign, size: "M", color: "Black" }] });
    expect(res.status).toBe(404);
    expect(fake.variants[0]?.productId).toBe(productB);
  });

  it("محصول منتشرشده بدون هیچ تنوع فعال → 409", async () => {
    const published = fake.addProduct(sellerA, "PUBLISHED");
    fake.addVariant(published, { size: "M", color: "Black", sku: "P-1" });
    const res = await request(app).put(base(published)).set(asA).send({ variants: [] });
    expect(res.status).toBe(409);
    expect(fake.variants[0]?.isActive).toBe(true);
  });
});
