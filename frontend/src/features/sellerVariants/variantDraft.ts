import {
  variantColorSchema,
  variantCombinationKey,
  variantSizeSchema,
  variantSkuSchema,
  type ProductVariantSummary,
  type SyncVariantsInput,
} from "@vista/shared";
import { parseNumberInput } from "@/lib/utils/digits";

/** یک ردیف قابل ویرایش در Builder. فقط در کلاینت وجود دارد تا «ذخیره» صریح بزند. */
export interface VariantDraft {
  /** کلید پایدار React؛ برای تنوع موجود همان id است */
  key: string;
  /** وجود id یعنی این ردیف یک تنوع ذخیره‌شده است */
  id: string | null;
  color: string;
  size: string;
  sku: string;
  price: string;
  /** برای تنوع جدید: موجودی اولیه. برای تنوع موجود فقط نمایشی است (مدیریت موجودی فاز بعد) */
  stock: string;
}

export const PRESET_COLORS = ["مشکی", "کرم", "بژ", "سفید", "قهوه‌ای", "سرمه‌ای"] as const;
export const PRESET_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

let counter = 0;
const nextKey = () => `new-${++counter}`;

export function draftFromVariant(variant: ProductVariantSummary): VariantDraft {
  return {
    key: variant.id,
    id: variant.id,
    color: variant.color,
    size: variant.size,
    sku: variant.sku,
    price: variant.price === null ? "" : String(variant.price),
    stock: String(variant.stock),
  };
}

/** SKU فقط وقتی پیشنهاد می‌شود که رنگ و سایز لاتین باشند؛ وگرنه خالی می‌ماند و Backend یکی می‌سازد */
export function suggestSku(prefix: string, color: string, size: string): string {
  const latin = /^[A-Za-z0-9 ]+$/;
  if (!latin.test(color) || !latin.test(size)) return "";
  const part = (value: string) => value.trim().replace(/\s+/g, "").toUpperCase();
  const cleanPrefix = prefix.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 12);
  return [cleanPrefix, part(color).slice(0, 3), part(size)].filter(Boolean).join("-");
}

/**
 * ضرب دکارتی رنگ × سایز. ترکیب‌هایی که همین الان در ردیف‌ها هست دوباره ساخته نمی‌شود
 * (تولید دوباره هرگز ردیف تکراری نمی‌سازد). فقط راحتی UI است؛ مرجع نهایی Backend است.
 */
export function generateCombinations(
  colors: string[],
  sizes: string[],
  existing: VariantDraft[],
  skuPrefix: string,
): VariantDraft[] {
  const taken = new Set(existing.map((draft) => variantCombinationKey(draft)));
  const added: VariantDraft[] = [];
  for (const color of colors) {
    for (const size of sizes) {
      const key = variantCombinationKey({ color, size });
      if (taken.has(key)) continue;
      taken.add(key);
      added.push({
        key: nextKey(),
        id: null,
        color,
        size,
        sku: suggestSku(skuPrefix, color, size),
        price: "",
        stock: "0",
      });
    }
  }
  return added;
}

export type DraftErrors = Record<string, Partial<Record<"color" | "size" | "sku" | "price" | "stock", string>>>;

/** اعتبارسنجی UX (همان Schemaهای shared). Backend باز هم مرجع نهایی است. */
export function validateDrafts(drafts: VariantDraft[]): DraftErrors {
  const errors: DraftErrors = {};
  const setError = (key: string, field: "color" | "size" | "sku" | "price" | "stock", message: string) => {
    errors[key] = { ...errors[key], [field]: errors[key]?.[field] ?? message };
  };

  const combos = new Map<string, string>();
  const skus = new Map<string, string>();

  for (const draft of drafts) {
    const color = variantColorSchema.safeParse(draft.color);
    if (!color.success) setError(draft.key, "color", color.error.issues[0]?.message ?? "رنگ معتبر نیست");
    const size = variantSizeSchema.safeParse(draft.size);
    if (!size.success) setError(draft.key, "size", size.error.issues[0]?.message ?? "سایز معتبر نیست");

    if (draft.sku.trim() !== "") {
      const sku = variantSkuSchema.safeParse(draft.sku);
      if (!sku.success) setError(draft.key, "sku", sku.error.issues[0]?.message ?? "SKU معتبر نیست");
      else if (skus.has(sku.data)) {
        setError(draft.key, "sku", "این SKU تکراری است");
        setError(skus.get(sku.data) as string, "sku", "این SKU تکراری است");
      } else skus.set(sku.data, draft.key);
    }

    if (color.success && size.success) {
      const key = variantCombinationKey({ color: color.data, size: size.data });
      const owner = combos.get(key);
      if (owner !== undefined) {
        setError(draft.key, "color", "این ترکیب رنگ و سایز تکراری است");
        setError(owner, "color", "این ترکیب رنگ و سایز تکراری است");
      } else combos.set(key, draft.key);
    }

    const price = parseNumberInput(draft.price);
    if (price !== undefined && (!Number.isInteger(price) || price <= 0 || price > 1_000_000_000)) {
      setError(draft.key, "price", "قیمت باید عدد صحیح مثبت باشد");
    }
    const stock = parseNumberInput(draft.stock);
    if (draft.id === null && stock !== undefined && (!Number.isInteger(stock) || stock < 0)) {
      setError(draft.key, "stock", "موجودی باید عدد صحیح و حداقل صفر باشد");
    }
  }
  return errors;
}

export function toSyncPayload(drafts: VariantDraft[]): SyncVariantsInput {
  const payload: SyncVariantsInput = {
    variants: drafts.map((draft) => {
      const price = parseNumberInput(draft.price);
      return {
        ...(draft.id ? { id: draft.id } : {}),
        color: draft.color,
        size: draft.size,
        ...(draft.sku.trim() ? { sku: draft.sku } : {}),
        price: price ?? null,
        // موجودی فقط برای تنوع جدید معنا دارد؛ برای موجود، Backend نادیده می‌گیرد
        stock: draft.id === null ? (parseNumberInput(draft.stock) ?? 0) : 0,
      };
    }),
  };
  return payload;
}
