import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("env validation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("rejects mock payment auto-confirm in production", async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://x",
      JWT_ACCESS_SECRET: "a".repeat(32),
      JWT_REFRESH_SECRET: "b".repeat(32),
      CORS_ORIGIN: "http://localhost:3000",
      MOCK_PAYMENT_AUTO_CONFIRM: "true",
    };
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);
    await expect(import("../../src/config/env")).rejects.toThrow();
    expect(exitSpy).toHaveBeenCalled();
  });

  it("allows production when mock payment is disabled", async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://x",
      JWT_ACCESS_SECRET: "a".repeat(32),
      JWT_REFRESH_SECRET: "b".repeat(32),
      CORS_ORIGIN: "http://localhost:3000",
      MOCK_PAYMENT_AUTO_CONFIRM: "false",
    };
    const mod = await import("../../src/config/env");
    expect(mod.env.MOCK_PAYMENT_AUTO_CONFIRM).toBe(false);
  });

  it("allows development with mock payment enabled", async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://x",
      JWT_ACCESS_SECRET: "a".repeat(32),
      JWT_REFRESH_SECRET: "b".repeat(32),
      CORS_ORIGIN: "http://localhost:3000",
      MOCK_PAYMENT_AUTO_CONFIRM: "true",
    };
    const mod = await import("../../src/config/env");
    expect(mod.env.MOCK_PAYMENT_AUTO_CONFIRM).toBe(true);
  });
});
