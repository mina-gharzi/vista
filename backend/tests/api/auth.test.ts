import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { signAccessToken } from "../../src/utils/tokens";
import { buildAuthApp, extractRefreshCookie, validRegistration } from "../helpers/buildAuthApp";

vi.mock("../../src/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

async function registered() {
  const ctx = buildAuthApp();
  const res = await request(ctx.app).post("/api/auth/register").send(validRegistration);
  return { ...ctx, res, refresh: extractRefreshCookie(res.headers["set-cookie"]) };
}

describe("POST /api/auth/register", () => {
  it("کاربر می‌سازد، Access Token می‌دهد و Refresh Token را فقط در Cookie امن می‌گذارد", async () => {
    const { res } = await registered();

    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({ email: "mina@example.com", role: "CUSTOMER" });
    // هرگز نباید Hash رمز یا Refresh Token در Body باشد
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2|refresh/i);

    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/api/auth");
  });

  it("Mass Assignment: role ارسالی توسط Client نادیده گرفته می‌شود", async () => {
    const { app } = buildAuthApp();
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validRegistration, role: "ADMIN" });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe("CUSTOMER");
  });

  it("رمز عبور در Database به‌صورت Argon2id هش می‌شود", async () => {
    const { repo } = await registered();
    const [user] = [...repo.users.values()];
    expect(user?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user?.passwordHash).not.toContain(validRegistration.password);
  });

  it("ایمیل تکراری → 409", async () => {
    const { app } = await registered();
    const res = await request(app).post("/api/auth/register").send(validRegistration);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT_ERROR");
  });

  it("رمز ضعیف یا بیش‌ازحد بلند → 400 با details", async () => {
    const { app } = buildAuthApp();
    const weak = await request(app)
      .post("/api/auth/register")
      .send({ ...validRegistration, password: "weak" });
    expect(weak.status).toBe(400);
    expect(weak.body.error.details.password).toBeDefined();

    const huge = await request(app)
      .post("/api/auth/register")
      .send({ ...validRegistration, password: `Aa1${"x".repeat(200)}` });
    expect(huge.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("با اطلاعات درست وارد می‌شود", async () => {
    const { app } = await registered();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "MINA@example.com", password: validRegistration.password });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe("mina@example.com");
    expect(extractRefreshCookie(res.headers["set-cookie"])).toBeDefined();
  });

  it("رمز اشتباه و ایمیل ناموجود پیام و کد یکسان دارند (جلوگیری از User Enumeration)", async () => {
    const { app } = await registered();
    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: validRegistration.email, password: "WrongPassw0rd" });
    const unknownEmail = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "WrongPassw0rd" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });
});

describe("GET /api/auth/me و Authorization", () => {
  it("بدون توکن → 401", async () => {
    const { app } = buildAuthApp();
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
  });

  it("با Access Token معتبر کاربر را برمی‌گرداند", async () => {
    const { app, res } = await registered();
    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${res.body.data.accessToken}`);

    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe("mina@example.com");
  });

  it("توکن دست‌کاری‌شده یا امضاشده با کلید دیگر → 401", async () => {
    const { app, res } = await registered();
    const token: string = res.body.data.accessToken;

    const tampered = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token.slice(0, -3)}abc`);
    expect(tampered.status).toBe(401);

    const jwt = await import("jsonwebtoken");
    const foreign = jwt.default.sign({ role: "ADMIN" }, "another_secret_that_is_32_chars_long!!", {
      subject: "8d7a4a6e-1111-4111-8111-111111111111",
      issuer: "vista",
    });
    const forged = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${foreign}`);
    expect(forged.status).toBe(401);
  });

  it("RBAC: CUSTOMER به Route مخصوص ADMIN دسترسی ندارد (403) اما ADMIN دارد", async () => {
    const { app, res } = await registered();
    const customer = await request(app)
      .get("/admin-only")
      .set("Authorization", `Bearer ${res.body.data.accessToken}`);
    expect(customer.status).toBe(403);

    const adminToken = signAccessToken({ userId: res.body.data.user.id, role: "ADMIN" });
    const admin = await request(app)
      .get("/admin-only")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(admin.status).toBe(200);
  });
});

describe("POST /api/auth/refresh", () => {
  it("بدون Cookie → 401", async () => {
    const { app } = buildAuthApp();
    expect((await request(app).post("/api/auth/refresh")).status).toBe(401);
  });

  it("توکن را Rotate می‌کند: Cookie جدید صادر و توکن قبلی باطل می‌شود", async () => {
    const { app, refresh } = await registered();

    const first = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `vista_refresh=${refresh}`);
    const newRefresh = extractRefreshCookie(first.headers["set-cookie"]);

    expect(first.status).toBe(200);
    expect(first.body.data.accessToken).toEqual(expect.any(String));
    expect(newRefresh).toBeDefined();
    expect(newRefresh).not.toBe(refresh);

    const replay = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `vista_refresh=${refresh}`);
    expect(replay.status).toBe(401);
  });

  it("Reuse Detection: استفاده مجدد از توکن باطل‌شده (بعد از بازه Race) تمام نشست‌ها را باطل می‌کند", async () => {
    let clock = new Date("2026-01-01T10:00:00Z");
    const { app, repo } = buildAuthApp(() => clock);
    const reg = await request(app).post("/api/auth/register").send(validRegistration);
    const stolen = extractRefreshCookie(reg.headers["set-cookie"]);

    const rotated = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `vista_refresh=${stolen}`);
    const legit = extractRefreshCookie(rotated.headers["set-cookie"]);
    expect(rotated.status).toBe(200);

    // زمان می‌گذرد؛ مهاجم توکن قدیمی را استفاده می‌کند
    repo.tokens.forEach((token) => {
      if (token.revokedAt) token.revokedAt = new Date("2026-01-01T10:00:00Z");
    });
    clock = new Date("2026-01-01T10:05:00Z");

    const attack = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `vista_refresh=${stolen}`);
    expect(attack.status).toBe(401);

    // توکن قانونی کاربر هم باطل شده است
    const victim = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `vista_refresh=${legit}`);
    expect(victim.status).toBe(401);
  });

  it("Refresh Token منقضی‌شده → 401", async () => {
    let clock = new Date("2026-01-01T10:00:00Z");
    const { app } = buildAuthApp(() => clock);
    const reg = await request(app).post("/api/auth/register").send(validRegistration);
    const token = extractRefreshCookie(reg.headers["set-cookie"]);

    clock = new Date("2026-02-01T10:00:00Z"); // ۳۱ روز بعد (> ۷ روز)
    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `vista_refresh=${token}`);
    expect(res.status).toBe(401);
  });

  it("CSRF: Origin غیرمجاز → 403", async () => {
    const { app, refresh } = await registered();
    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Origin", "https://evil.example")
      .set("Cookie", `vista_refresh=${refresh}`);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/auth/logout", () => {
  it("توکن را باطل و Cookie را پاک می‌کند؛ Refresh بعدی 401 است", async () => {
    const { app, refresh } = await registered();

    const out = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", `vista_refresh=${refresh}`);
    expect(out.status).toBe(200);
    expect(String(out.headers["set-cookie"])).toContain("vista_refresh=;");

    const again = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `vista_refresh=${refresh}`);
    expect(again.status).toBe(401);
  });

  it("Idempotent است: بدون Cookie هم 200 برمی‌گرداند", async () => {
    const { app } = buildAuthApp();
    expect((await request(app).post("/api/auth/logout")).status).toBe(200);
  });
});
