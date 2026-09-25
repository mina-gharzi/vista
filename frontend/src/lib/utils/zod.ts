interface IssueLike {
  path: ReadonlyArray<string | number>;
  message: string;
}

/** اولین پیام خطا برای هر فیلد: `{ email: "ایمیل معتبر نیست" }` */
export function firstFieldErrors(error: {
  issues: ReadonlyArray<IssueLike>;
}): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_root";
    if (result[key] === undefined) result[key] = issue.message;
  }
  return result;
}

/** تبدیل details بک‌اند (`{field: string[]}`) به همان ساختار بالا */
export function firstBackendErrors(
  details: Record<string, string[]> | undefined,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [field, messages] of Object.entries(details ?? {})) {
    const first = messages[0];
    if (first !== undefined) result[field] = first;
  }
  return result;
}
