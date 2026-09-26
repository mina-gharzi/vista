type RawSearchParams = Record<string, string | string[] | undefined>;

/** Next.js پارامتر تکراری را آرایه می‌دهد؛ ما همیشه اولین مقدار را می‌خواهیم. */
export function normalizeSearchParams(raw: RawSearchParams): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined && first !== "") result[key] = first;
  }
  return result;
}

/** آدرس جدید با همان Queryهای فعلی به‌علاوه/به‌جای Override؛ Override با undefined یعنی حذف آن کلید. */
export function withQuery(
  basePath: string,
  current: Record<string, string>,
  overrides: Record<string, string | number | undefined>,
): string {
  const params = new URLSearchParams(current);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) params.delete(key);
    else params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
