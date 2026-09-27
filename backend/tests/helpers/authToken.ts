import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "test_access_secret_min_32_chars_long_000";

/** توکن معتبر Access Token برای شبیه‌سازی هدر Authorization در تست‌ها (باید issuer را هم داشته باشد). */
export function bearerFor(
  userId: string,
  role: "CUSTOMER" | "SELLER" | "ADMIN" = "SELLER",
): string {
  const token = jwt.sign({ role }, ACCESS_SECRET, {
    subject: userId,
    issuer: "vista", // باید با ISSUER در src/utils/tokens.ts یکی باشد
    expiresIn: "15m",
  });
  return `Bearer ${token}`;
}
