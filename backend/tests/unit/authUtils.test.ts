import { describe, expect, it } from "vitest";
import { AuthenticationError } from "../../src/errors/AppError";
import { hashPassword, verifyPassword } from "../../src/utils/password";
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from "../../src/utils/tokens";

describe("password", () => {
  it("هش می‌کند و فقط رمز درست را تأیید می‌کند", async () => {
    const hash = await hashPassword("Str0ngPassw0rd");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, "Str0ngPassw0rd")).toBe(true);
    expect(await verifyPassword(hash, "Str0ngPassw0rD")).toBe(false);
  });

  it("هش خراب Throw نمی‌کند و false برمی‌گرداند", async () => {
    expect(await verifyPassword("not-a-hash", "x")).toBe(false);
  });
});

describe("tokens", () => {
  const userId = "8d7a4a6e-1111-4111-8111-111111111111";

  it("Access Token رفت‌وبرگشت درست دارد", () => {
    const token = signAccessToken({ userId, role: "SELLER" });
    expect(verifyAccessToken(token)).toEqual({ userId, role: "SELLER" });
  });

  it("رشته نامعتبر → AuthenticationError", () => {
    expect(() => verifyAccessToken("garbage")).toThrow(AuthenticationError);
  });

  it("Refresh Token تصادفی و یکتاست و Hash آن قطعی است (و خودش ذخیره نمی‌شود)", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).toBe(hashRefreshToken(a.token));
    expect(a.hash).not.toContain(a.token);
    expect(a.token.length).toBeGreaterThanOrEqual(43);
  });
});
