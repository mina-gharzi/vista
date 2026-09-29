import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { buildAuthApp, extractRefreshCookie, validRegistration } from "../helpers/buildAuthApp";

vi.mock("../../src/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

async function loggedIn() {
  const ctx = buildAuthApp();
  const res = await request(ctx.app).post("/api/auth/register").send(validRegistration);
  return {
    ...ctx,
    bearer: `Bearer ${res.body.data.accessToken as string}`,
    refresh: extractRefreshCookie(res.headers["set-cookie"]) ?? "",
  };
}

describe("PATCH /api/auth/me", () => {
  it("بدون ورود 401 می‌دهد", async () => {
    const { app } = buildAuthApp();
    const res = await request(app).patch("/api/auth/me").send({ fullName: "نام جدید" });
    expect(res.status).toBe(401);
  });

  it("نام و موبایل را ویرایش می‌کند", async () => {
    const { app, bearer } = await loggedIn();

    const res = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", bearer)
      .send({ fullName: "مینا رضایی", phone: "09121234567" });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ fullName: "مینا رضایی", phone: "09121234567" });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
  });

  it("رشته خالی برای phone، شماره را حذف می‌کند", async () => {
    const { app, bearer } = await loggedIn();
    await request(app)
      .patch("/api/auth/me")
      .set("Authorization", bearer)
      .send({ phone: "09121234567" });

    const res = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", bearer)
      .send({ phone: "" });

    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBeNull();
  });

  it("Mass Assignment: email و role نادیده گرفته می‌شوند", async () => {
    const { app, bearer } = await loggedIn();

    const res = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", bearer)
      .send({ fullName: "مینا رضایی", role: "ADMIN", email: "hacker@evil.com" });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe("CUSTOMER");
    expect(res.body.data.email).toBe(validRegistration.email);
  });

  it("موبایل نامعتبر و بدنه خالی 400 می‌دهند", async () => {
    const { app, bearer } = await loggedIn();

    const badPhone = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", bearer)
      .send({ phone: "123" });
    const empty = await request(app).patch("/api/auth/me").set("Authorization", bearer).send({});

    expect(badPhone.status).toBe(400);
    expect(empty.status).toBe(400);
  });
});

describe("POST /api/auth/change-password", () => {
  const newPassword = "Brand9NewPass";

  it("رمز فعلی اشتباه → 400 (نه 401) و رمز تغییر نمی‌کند", async () => {
    const { app, repo, bearer } = await loggedIn();
    const before = [...repo.users.values()][0]?.passwordHash;

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", bearer)
      .send({ currentPassword: "WrongPass123", newPassword });

    expect(res.status).toBe(400);
    expect(res.body.error.details.currentPassword).toBeDefined();
    expect([...repo.users.values()][0]?.passwordHash).toBe(before);
  });

  it("رمز جدید ضعیف یا مساوی رمز فعلی 400 می‌دهد", async () => {
    const { app, bearer } = await loggedIn();

    const weak = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", bearer)
      .send({ currentPassword: validRegistration.password, newPassword: "weak" });
    const same = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", bearer)
      .send({
        currentPassword: validRegistration.password,
        newPassword: validRegistration.password,
      });

    expect(weak.status).toBe(400);
    expect(same.status).toBe(400);
  });

  it("موفق: رمز عوض می‌شود، نشست‌های قدیمی باطل و نشست تازه صادر می‌شود", async () => {
    const { app, bearer, refresh } = await loggedIn();

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", bearer)
      .send({ currentPassword: validRegistration.password, newPassword });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    const newRefresh = extractRefreshCookie(res.headers["set-cookie"]);
    expect(newRefresh).toBeTruthy();
    expect(newRefresh).not.toBe(refresh);

    // Refresh Token قدیمی (مثلاً دستگاه دیگر) دیگر کار نمی‌کند
    const oldRefresh = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `vista_refresh=${refresh}`);
    expect(oldRefresh.status).toBe(401);

    // ورود با رمز قدیمی رد و با رمز جدید موفق است
    const oldLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: validRegistration.email, password: validRegistration.password });
    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: validRegistration.email, password: newPassword });
    expect(oldLogin.status).toBe(401);
    expect(newLogin.status).toBe(200);
  });

  it("Origin غیرمجاز 403 می‌دهد", async () => {
    const { app, bearer } = await loggedIn();

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", bearer)
      .set("Origin", "https://evil.example")
      .send({ currentPassword: validRegistration.password, newPassword });

    expect(res.status).toBe(403);
  });
});
