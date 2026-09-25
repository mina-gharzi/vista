interface IssueLike {
  path: ReadonlyArray<string | number>;
  message: string;
}

/**
 * تشخیص ZodError بدون تکیه بر `instanceof`.
 * دلیل: Schemaها در پکیج `@vista/shared` تعریف می‌شوند و اگر نسخه/مسیر نصب zod در shared و backend
 * یکی نباشد (دو کپی از zod)، `instanceof ZodError` برای خطای Schema مشترک false می‌شود
 * و اعتبارسنجی به‌اشتباه 500 برمی‌گرداند.
 */
export function isZodError(error: unknown): error is Error & { issues: IssueLike[] } {
  return (
    error instanceof Error &&
    error.name === "ZodError" &&
    "issues" in error &&
    Array.isArray(error.issues)
  );
}

/**
 * تبدیل ZodError به ساختار `{ field: [messages] }` که در ApiErrorResponse برگردانده می‌شود.
 * مسیرهای تو در تو با نقطه به هم وصل می‌شوند (مثلاً "address.postalCode").
 * خطاهای سطح ریشه (مثلاً Body اشتباه) زیر کلید "_root" می‌آیند.
 */
export function toFieldErrors(error: {
  issues: ReadonlyArray<IssueLike>;
}): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_root";
    const messages = result[key] ?? [];
    messages.push(issue.message);
    result[key] = messages;
  }

  return result;
}
