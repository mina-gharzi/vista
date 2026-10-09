import { getEffectivePrice, type PublicProductVariant } from "@vista/shared";

const norm = (value: string) => value.trim().toLowerCase();

/** مقادیر یکتا به ترتیب اولین ظهور (ترتیب سایز/رنگ همان ترتیبی است که فروشنده ساخته) */
export function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = norm(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function resolveVariant(
  variants: PublicProductVariant[],
  color: string,
  size: string,
): PublicProductVariant | null {
  if (!color || !size) return null;
  return variants.find((v) => norm(v.color) === norm(color) && norm(v.size) === norm(size)) ?? null;
}

export type CombinationState = "unselected" | "missing" | "out_of_stock" | "available";

export function combinationState(
  variants: PublicProductVariant[],
  color: string,
  size: string,
): CombinationState {
  if (!color || !size) return "unselected";
  const variant = resolveVariant(variants, color, size);
  if (!variant) return "missing";
  return variant.stock > 0 ? "available" : "out_of_stock";
}

/** آیا این رنگ حداقل یک سایزِ موجود دارد؟ (برای کم‌رنگ‌کردن چیپ‌ها؛ انتخابش همچنان ممکن است) */
export function colorHasStock(variants: PublicProductVariant[], color: string): boolean {
  return variants.some((v) => norm(v.color) === norm(color) && v.stock > 0);
}

export function sizeHasStock(variants: PublicProductVariant[], size: string, color: string): boolean {
  return variants.some(
    (v) => norm(v.size) === norm(size) && (!color || norm(v.color) === norm(color)) && v.stock > 0,
  );
}

/**
 * قیمتی که صفحه نشان می‌دهد:
 * - تنوع انتخاب‌شده → قیمت مؤثر همان تنوع (فقط یک تعریف: getEffectivePrice)
 * - هنوز انتخابی نیست → اگر قیمت تنوع‌ها یکی نیست «از ...» (کمترین قیمت مؤثر)
 */
export function displayedPrice(
  variants: PublicProductVariant[],
  selected: PublicProductVariant | null,
  basePrice: number,
): { amount: number; isFrom: boolean } {
  if (selected) return { amount: getEffectivePrice(selected, basePrice), isFrom: false };
  const prices = variants.map((v) => getEffectivePrice(v, basePrice));
  if (prices.length === 0) return { amount: basePrice, isFrom: false };
  const min = Math.min(...prices);
  return { amount: min, isFrom: prices.some((p) => p !== min) };
}
