import { randomBytes } from "node:crypto";

/**
 * تبدیل عنوان (معمولاً فارسی) به Slug لاتین. چون بیشتر عنوان‌های VISTA فارسی هستند،
 * فقط بخش لاتین/عددی قابل‌استفاده استخراج می‌شود؛ اگر چیزی باقی نماند، به "product" برمی‌گردد.
 * نتیجه این تابع به‌تنهایی Unique نیست — همیشه با withUniqueSuffix همراه شود.
 */
export function slugify(title: string): string {
  const ascii = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");

  return ascii.length >= 3 ? ascii : "product";
}

/** پسوند کوتاه تصادفی برای یکتا کردن Slug (مثلاً "پیراهن کتان" → "product-a1b2c3") */
export function withUniqueSuffix(base: string): string {
  return `${base}-${randomBytes(3).toString("hex")}`;
}
