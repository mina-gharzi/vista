import type { Express } from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

describe("rate limit IP spoofing (trust proxy unset)", () => {
  const originalEnv = { ...process.env };
  let app: Express;

  beforeAll(async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://test:test@localhost:5432/vista_test?schema=public",
      JWT_ACCESS_SECRET: "test_access_secret_min_32_chars_long_000",
      JWT_REFRESH_SECRET: "test_refresh_secret_min_32_chars_long_00",
      CORS_ORIGIN: "http://localhost:3000",
      MOCK_PAYMENT_AUTO_CONFIRM: "false",
    };
    const { buildAuthApp } = await import("../helpers/buildAuthApp");
    app = buildAuthApp().app;
  });

  afterAll(() => {
    process.env = { ...originalEnv };
  });

  it("ignores X-Forwarded-For for rate-limit key", async () => {
    const body = { email: "x@y.com", password: "wrongpassword123" };
    // 10 allowed attempts (limit)
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", `10.0.0.${i + 1}`)
        .send(body);
      expect(res.status).not.toBe(429);
    }
    // 11th must be rate-limited regardless of spoofed header
    const blocked = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", "192.168.99.99")
      .send(body);
    expect(blocked.status).toBe(429);
    expect(blocked.body?.error?.code).toBe("RATE_LIMITED");
  });
});
