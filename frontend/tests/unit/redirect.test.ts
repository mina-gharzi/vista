import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/utils/redirect";

describe("safeRedirectPath (جلوگیری از Open Redirect)", () => {
  it("مسیرهای داخلی را می‌پذیرد", () => {
    expect(safeRedirectPath("/account")).toBe("/account");
    expect(safeRedirectPath("/products?page=2")).toBe("/products?page=2");
  });

  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "javascript:alert(1)",
    "account",
    "",
    "/ok\nheader",
  ])("مقدار خطرناک %j را رد می‌کند", (value) => {
    expect(safeRedirectPath(value)).toBe("/account");
  });

  it("مقدار خالی یا آرایه را مدیریت می‌کند", () => {
    expect(safeRedirectPath(undefined)).toBe("/account");
    expect(safeRedirectPath(["/cart", "/x"])).toBe("/cart");
    expect(safeRedirectPath(undefined, "/")).toBe("/");
  });
});
