/**
 * نرمال‌سازی متن جستجو (مشترک بین Frontend و Backend تا هر دو دقیقاً یک تعریف داشته باشند).
 *
 * - ی/ک عربی (ي ى ك) → فارسی، ة و ۀ → ه
 * - ارقام فارسی/عربی → لاتین
 * - حذف اعراب و کشیده، تبدیل نیم‌فاصله به فاصله (تا «کت‌شلوار» و «کت شلوار» یکی شوند)
 * - حذف نویسه‌های کنترلی/نامرئی و نویسه‌های wildcard الگوی LIKE (% _ \)
 * - Lower-case و یکی‌کردن فاصله‌ها
 */
const DIGITS: Record<string, string> = {
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

export function normalizeSearchText(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[۰-۹٠-٩]/g, (d) => DIGITS[d] ?? d)
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ةۀ]/g, "ه")
    .replace(/[ً-ٰٟـ]/g, "") // اعراب و کشیده
    .replace(/‌/g, " ") // نیم‌فاصله → فاصله
    .replace(/[​‍‎‏‪-‮⁦-⁩﻿]/g, "")
    // eslint-disable-next-line no-control-regex -- حذف نویسه‌های کنترلی عمداً است
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[%_\\]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export const MAX_SEARCH_TOKENS = 5;
export const MAX_SEARCH_TOKEN_LENGTH = 40;

/** کلمه‌های یکتای جستجو (حداکثر ۵ کلمه، هر کدام حداکثر ۴۰ نویسه) تا Query همیشه کراندار باشد. */
export function searchTokens(normalized: string): string[] {
  const seen = new Set<string>();
  for (const raw of normalized.split(" ")) {
    const token = raw.slice(0, MAX_SEARCH_TOKEN_LENGTH);
    if (token !== "") seen.add(token);
    if (seen.size >= MAX_SEARCH_TOKENS) break;
  }
  return [...seen];
}

/**
 * ی/ک فارسی ← معادل عربی؛ دادهٔ قدیمی دیتابیس ممکن است با کیبورد عربی ثبت شده باشد و Prisma
 * نمی‌تواند سمت دیتابیس نرمال‌سازی کند. برای هر کلمه حداکثر دو شکل (اصلی + عربی) جستجو می‌شود.
 */
export function legacyArabicVariant(token: string): string {
  return token.replace(/ی/g, "ي").replace(/ک/g, "ك");
}
