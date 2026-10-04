import express, { type Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../src/middlewares/errorHandler";
import { signAccessToken } from "../../src/utils/tokens";
import { createSellersController } from "../../src/modules/sellers/sellers.controller";
import { createSellersRouter } from "../../src/modules/sellers/sellers.routes";
import { createSellersService } from "../../src/modules/sellers/sellers.service";
import { createFakeSellersRepository } from "../helpers/fakeSellersRepository";

// env.ts در زمان Import اعتبارسنجی می‌شود؛ vi.hoisted قبل از همه Importها اجرا می‌شود
vi.hoisted(() => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
  process.env.JWT_ACCESS_SECRET ??= "test-access-secret-test-access-secret-1234";
  process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-test-refresh-secret-123";
  process.env.CORS_ORIGIN ??= "http://localhost:3000";
});

const CUSTOMER = "11111111-1111-4111-8111-111111111111";
const OTHER_CUSTOMER = "22222222-2222-4222-8222-222222222222";
const ADMIN = "33333333-3333-4333-8333-333333333333";
const GHOST = "44444444-4444-4444-8444-444444444444"; // توکن معتبر ولی کاربری در DB نیست

const validBody = {
  storeName: "فروشگاه لباس رویا",
  storeSlug: "roya-fashion",
  description: "پوشاک زنانه",
};

let app: Express;
let fake: ReturnType<typeof createFakeSellersRepository>;

const tokenFor = (userId: string, role: "CUSTOMER" | "SELLER" | "ADMIN" = "CUSTOMER") =>
  `Bearer ${signAccessToken({ userId, role })}`;

beforeEach(() => {
  fake = createFakeSellersRepository();
  fake.addUser(CUSTOMER);
  fake.addUser(OTHER_CUSTOMER);
  fake.addUser(ADMIN, "ADMIN");

  app = express();
  app.use(express.json());
  app.use(
    "/api/seller",
    createSellersRouter(createSellersController(createSellersService(fake.repository))),
  );
  app.use(errorHandler);
});

describe("POST /api/seller/apply", () => {
  it("1) بدون احراز هویت رد می‌شود (401) و چیزی ساخته نمی‌شود", async () => {
    const res = await request(app).post("/api/seller/apply").send(validBody);
    expect(res.status).toBe(401);
    expect(fake.count()).toBe(0);
  });

  it("1b) توکن نامعتبر هم رد می‌شود", async () => {
    const res = await request(app)
      .post("/api/seller/apply")
      .set("Authorization", "Bearer not-a-token")
      .send(validBody);
    expect(res.status).toBe(401);
  });

  it("2) درخواست معتبر: Seller با وضعیت PENDING ساخته و پاسخ امن برگردانده می‌شود", async () => {
    const res = await request(app)
      .post("/api/seller/apply")
      .set("Authorization", tokenFor(CUSTOMER))
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      storeName: validBody.storeName,
      storeSlug: validBody.storeSlug,
      description: validBody.description,
      status: "PENDING",
    });
    expect(res.body.data).not.toHaveProperty("userId");
    expect(res.body.data).not.toHaveProperty("id");
    expect(fake.getStored(CUSTOMER)?.status).toBe("PENDING");
  });

  it("2b) Slug به حروف کوچک نرمال می‌شود و توضیحات خالی null ذخیره می‌شود", async () => {
    const res = await request(app)
      .post("/api/seller/apply")
      .set("Authorization", tokenFor(CUSTOMER))
      .send({ storeName: "  فروشگاه  ", storeSlug: "  My-Store ", description: "   " });

    expect(res.status).toBe(201);
    expect(res.body.data.storeSlug).toBe("my-store");
    expect(res.body.data.storeName).toBe("فروشگاه");
    expect(res.body.data.description).toBeNull();
  });

  it("3) درخواست تکراری (PENDING) با 409 رد می‌شود و رکورد دوم ساخته نمی‌شود", async () => {
    fake.seedSeller(CUSTOMER, "PENDING", "first-store");
    const res = await request(app)
      .post("/api/seller/apply")
      .set("Authorization", tokenFor(CUSTOMER))
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT_ERROR");
    expect(fake.count()).toBe(1);
    expect(fake.getStored(CUSTOMER)?.storeSlug).toBe("first-store");
  });

  it("4) فروشنده تأییدشده نمی‌تواند دوباره درخواست دهد (409) و وضعیتش تغییر نمی‌کند", async () => {
    fake.seedSeller(CUSTOMER, "APPROVED", "approved-store");
    const res = await request(app)
      .post("/api/seller/apply")
      .set("Authorization", tokenFor(CUSTOMER))
      .send(validBody);

    expect(res.status).toBe(409);
    expect(fake.getStored(CUSTOMER)?.status).toBe("APPROVED");
    expect(fake.getStored(CUSTOMER)?.storeSlug).toBe("approved-store");
  });

  it.each([
    ["خالی", "", "نام فروشگاه الزامی است."],
    ["فقط فاصله", "   ", "نام فروشگاه الزامی است."],
    ["کوتاه", "اب", "نام فروشگاه باید حداقل ۳ کاراکتر باشد."],
    ["بلند", "ا".repeat(61), "نام فروشگاه نباید بیشتر از ۶۰ کاراکتر باشد."],
  ])("5) نام فروشگاه نامعتبر (%s) با 400 و پیام فارسی رد می‌شود", async (_label, storeName, message) => {
    const res = await request(app)
      .post("/api/seller/apply")
      .set("Authorization", tokenFor(CUSTOMER))
      .send({ ...validBody, storeName });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.storeName).toContain(message);
    expect(fake.count()).toBe(0);
  });

  it("5b) نبودن نام فروشگاه در Body", async () => {
    const res = await request(app)
      .post("/api/seller/apply")
      .set("Authorization", tokenFor(CUSTOMER))
      .send({ storeSlug: "ok-slug" });
    expect(res.status).toBe(400);
    expect(res.body.error.details.storeName).toContain("نام فروشگاه الزامی است.");
  });

  it.each([
    ["فارسی", "فروشگاه"],
    ["فاصله وسط", "my store"],
    ["خط تیره ابتدا", "-store"],
    ["خط تیره انتها", "store-"],
    ["خط تیره پشت‌سرهم", "my--store"],
    ["کاراکتر خاص", "my_store!"],
    ["خیلی کوتاه", "ab"],
    ["خیلی بلند", "a".repeat(41)],
  ])("6) Slug نامعتبر (%s) با 400 رد می‌شود", async (_label, storeSlug) => {
    const res = await request(app)
      .post("/api/seller/apply")
      .set("Authorization", tokenFor(CUSTOMER))
      .send({ ...validBody, storeSlug });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty("storeSlug");
    expect(fake.count()).toBe(0);
  });

  it("6b) توضیحات بیش از ۵۰۰ کاراکتر رد می‌شود", async () => {
    const res = await request(app)
      .post("/api/seller/apply")
      .set("Authorization", tokenFor(CUSTOMER))
      .send({ ...validBody, description: "ب".repeat(501) });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty("description");
  });

  it("7) Slug تکراری (متعلق به کاربر دیگر) با 409 و پیام فیلد رد می‌شود", async () => {
    fake.seedSeller(OTHER_CUSTOMER, "APPROVED", "roya-fashion");
    const res = await request(app)
      .post("/api/seller/apply")
      .set("Authorization", tokenFor(CUSTOMER))
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.error.details.storeSlug).toEqual(["شناسه فروشگاه باید یکتا باشد."]);
    expect(fake.getStored(CUSTOMER)).toBeUndefined();
  });

  it("7b) Slug با حروف بزرگ هم با Slug موجود یکی حساب می‌شود", async () => {
    fake.seedSeller(OTHER_CUSTOMER, "PENDING", "roya-fashion");
    const res = await request(app)
      .post("/api/seller/apply")
      .set("Authorization", tokenFor(CUSTOMER))
      .send({ ...validBody, storeSlug: "ROYA-Fashion" });
    expect(res.status).toBe(409);
  });
});

describe("Authorization — قابل دور زدن نیست", () => {
  it("10a) userId / role / status در Body نادیده گرفته می‌شود؛ هویت فقط از توکن است", async () => {
    const res = await request(app)
      .post("/api/seller/apply")
      .set("Authorization", tokenFor(CUSTOMER))
      .send({
        ...validBody,
        userId: OTHER_CUSTOMER,
        sellerId: "99999999-9999-4999-8999-999999999999",
        role: "ADMIN",
        status: "APPROVED",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("PENDING");
    expect(fake.getStored(CUSTOMER)?.status).toBe("PENDING");
    expect(fake.getStored(OTHER_CUSTOMER)).toBeUndefined();
  });

  it("10b) نقش جعلی در توکن کافی نیست: نقش ADMIN از Database خوانده می‌شود", async () => {
    const res = await request(app)
      .post("/api/seller/apply")
      .set("Authorization", tokenFor(ADMIN, "CUSTOMER")) // توکن می‌گوید CUSTOMER، DB می‌گوید ADMIN
      .send(validBody);
    expect(res.status).toBe(403);
    expect(fake.count()).toBe(0);
  });

  it("10c) ادمین نمی‌تواند درخواست فروشندگی بدهد", async () => {
    const res = await request(app)
      .post("/api/seller/apply")
      .set("Authorization", tokenFor(ADMIN, "ADMIN"))
      .send(validBody);
    expect(res.status).toBe(403);
  });

  it("10d) فروشنده تعلیق‌شده نمی‌تواند حساب جدید بسازد یا حساب را بازیابی کند (403)", async () => {
    fake.seedSeller(CUSTOMER, "SUSPENDED", "suspended-store");
    const res = await request(app)
      .post("/api/seller/apply")
      .set("Authorization", tokenFor(CUSTOMER))
      .send({ ...validBody, storeSlug: "brand-new-store" });
    expect(res.status).toBe(403);
    expect(fake.getStored(CUSTOMER)?.status).toBe("SUSPENDED");
    expect(fake.getStored(CUSTOMER)?.storeSlug).toBe("suspended-store");
  });

  it("10e) توکن معتبر برای کاربری که در DB نیست (حذف‌شده) → 401", async () => {
    const res = await request(app)
      .post("/api/seller/apply")
      .set("Authorization", tokenFor(GHOST))
      .send(validBody);
    expect(res.status).toBe(401);
  });

  it("10f) درخواست رد‌شده: ارسال مجدد همان رکورد را به PENDING برمی‌گرداند (رکورد جدید نمی‌سازد)", async () => {
    fake.seedSeller(CUSTOMER, "REJECTED", "old-slug", "نام قدیمی");
    const res = await request(app)
      .post("/api/seller/apply")
      .set("Authorization", tokenFor(CUSTOMER))
      .send({ ...validBody, status: "APPROVED" });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("PENDING");
    expect(res.body.data.storeSlug).toBe("roya-fashion");
    expect(fake.count()).toBe(1);
  });

  it("10g) کاربر رد‌شده می‌تواند Slug قبلی خودش را نگه دارد", async () => {
    fake.seedSeller(CUSTOMER, "REJECTED", "roya-fashion");
    const res = await request(app)
      .post("/api/seller/apply")
      .set("Authorization", tokenFor(CUSTOMER))
      .send(validBody);
    expect(res.status).toBe(201);
  });

  it("10h) نقش SELLER بدون رکورد Seller (وضعیت ناسازگار) → 403", async () => {
    fake.addUser(CUSTOMER, "SELLER");
    const res = await request(app)
      .post("/api/seller/apply")
      .set("Authorization", tokenFor(CUSTOMER, "SELLER"))
      .send(validBody);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/seller/application/status", () => {
  it("بدون توکن → 401", async () => {
    const res = await request(app).get("/api/seller/application/status");
    expect(res.status).toBe(401);
  });

  it("بدون درخواست قبلی: application=null و canApply=true", async () => {
    const res = await request(app)
      .get("/api/seller/application/status")
      .set("Authorization", tokenFor(CUSTOMER));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ application: null, canApply: true });
  });

  it("8) وضعیت PENDING درست برگردانده می‌شود", async () => {
    fake.seedSeller(CUSTOMER, "PENDING", "pending-store", "فروشگاه در انتظار");
    const res = await request(app)
      .get("/api/seller/application/status")
      .set("Authorization", tokenFor(CUSTOMER));

    expect(res.status).toBe(200);
    expect(res.body.data.canApply).toBe(false);
    expect(res.body.data.application).toMatchObject({
      storeName: "فروشگاه در انتظار",
      storeSlug: "pending-store",
      status: "PENDING",
    });
    expect(res.body.data.application).not.toHaveProperty("userId");
  });

  it("9) وضعیت APPROVED درست برگردانده می‌شود", async () => {
    fake.seedSeller(CUSTOMER, "APPROVED", "approved-store");
    const res = await request(app)
      .get("/api/seller/application/status")
      .set("Authorization", tokenFor(CUSTOMER, "SELLER"));
    expect(res.status).toBe(200);
    expect(res.body.data.application.status).toBe("APPROVED");
    expect(res.body.data.canApply).toBe(false);
  });

  it("REJECTED: canApply=true، SUSPENDED: canApply=false", async () => {
    fake.seedSeller(CUSTOMER, "REJECTED", "rejected-store");
    fake.seedSeller(OTHER_CUSTOMER, "SUSPENDED", "suspended-store");

    const rejected = await request(app)
      .get("/api/seller/application/status")
      .set("Authorization", tokenFor(CUSTOMER));
    const suspended = await request(app)
      .get("/api/seller/application/status")
      .set("Authorization", tokenFor(OTHER_CUSTOMER));

    expect(rejected.body.data).toMatchObject({ canApply: true });
    expect(rejected.body.data.application.status).toBe("REJECTED");
    expect(suspended.body.data).toMatchObject({ canApply: false });
  });

  it("هر کاربر فقط وضعیت خودش را می‌بیند (IDOR)", async () => {
    fake.seedSeller(OTHER_CUSTOMER, "APPROVED", "someone-elses-store");
    const res = await request(app)
      .get("/api/seller/application/status?userId=" + OTHER_CUSTOMER)
      .set("Authorization", tokenFor(CUSTOMER));
    expect(res.body.data.application).toBeNull();
  });

  it("ادمین canApply=false دارد", async () => {
    const res = await request(app)
      .get("/api/seller/application/status")
      .set("Authorization", tokenFor(ADMIN, "ADMIN"));
    expect(res.body.data.canApply).toBe(false);
  });
});