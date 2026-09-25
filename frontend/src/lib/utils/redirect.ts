/**
 * جلوگیری از Open Redirect: پارامتر `next` فقط اگر یک مسیر داخلی (مثل /account) باشد پذیرفته می‌شود.
 * آدرس‌هایی مثل https://evil.com، //evil.com یا /\evil.com رد و به مسیر پیش‌فرض برگردانده می‌شوند.
 */
export function safeRedirectPath(
  next: string | string[] | undefined,
  fallback = "/account",
): string {
  const value = Array.isArray(next) ? next[0] : next;
  if (!value || value.length > 300) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  // کاراکترهای کنترلی (مثل \n و \r) برای تزریق هدر/رفتار ناخواسته رد می‌شوند
  if ([...value].some((char) => char.charCodeAt(0) < 32)) return fallback;
  return value;
}
