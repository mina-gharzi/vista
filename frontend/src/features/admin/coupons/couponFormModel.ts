import {
  createCouponSchema,
  updateCouponSchema,
  type AdminCouponDetail,
  type CouponDiscountType,
  type CreateCouponInput,
  type UpdateCouponInput,
} from "@vista/shared";
import { toLatinDigits, parseNumberInput } from "@/lib/utils/digits";
import { firstFieldErrors } from "@/lib/utils/zod";

/** وضعیت فرم: همه‌چیز رشته است تا ورودی ناقص/فارسی بدون از دست رفتن نگه داشته شود. */
export interface CouponFormValues {
  code: string;
  description: string;
  discountType: CouponDiscountType;
  discountValue: string;
  maxDiscountAmount: string;
  minPurchaseAmount: string;
  /** datetime-local: «YYYY-MM-DDTHH:mm» به وقت محلی مرورگر */
  startsAt: string;
  expiresAt: string;
  usageLimit: string;
  perUserLimit: string;
  sellerId: string;
  products: { id: string; title: string }[];
  categoryIds: string[];
}

export const EMPTY_COUPON_FORM: CouponFormValues = {
  code: "",
  description: "",
  discountType: "PERCENTAGE",
  discountValue: "",
  maxDiscountAmount: "",
  minPurchaseAmount: "",
  startsAt: "",
  expiresAt: "",
  usageLimit: "",
  perUserLimit: "",
  sellerId: "",
  products: [],
  categoryIds: [],
};

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO (UTC) → مقدار input از نوع datetime-local (وقت محلی) */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** مقدار datetime-local → ISO؛ خالی → undefined، نامعتبر → "invalid" */
export function localInputToIso(value: string): string | undefined | "invalid" {
  const v = toLatinDigits(value).trim();
  if (v === "") return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "invalid" : d.toISOString();
}

export function couponToForm(coupon: AdminCouponDetail): CouponFormValues {
  const str = (n: number | null) => (n === null ? "" : String(n));
  return {
    code: coupon.code,
    description: coupon.description ?? "",
    discountType: coupon.discountType,
    discountValue: String(coupon.discountValue),
    maxDiscountAmount: str(coupon.maxDiscountAmount),
    minPurchaseAmount: str(coupon.minPurchaseAmount),
    startsAt: isoToLocalInput(coupon.startsAt),
    expiresAt: isoToLocalInput(coupon.expiresAt),
    usageLimit: str(coupon.usageLimit),
    perUserLimit: str(coupon.perUserLimit),
    sellerId: coupon.sellerId ?? "",
    products: coupon.products,
    categoryIds: coupon.categories.map((c) => c.id),
  };
}

export type CouponPayloadResult<T> = { ok: true; payload: T } | { ok: false; errors: Record<string, string> };

/**
 * فرم → بدنهٔ API. خالی = «بدون محدودیت»: در ساخت حذف می‌شود، در ویرایش null می‌رود (تا مقدار قبلی پاک شود).
 * اعتبارسنجی نهایی با همان Zod Schema مشترک با سرور است؛ سرور به هر حال دوباره می‌سنجد.
 */
function buildBody(values: CouponFormValues, mode: "create" | "edit"): CouponPayloadResult<Record<string, unknown>> {
  const errors: Record<string, string> = {};
  const num = (key: keyof CouponFormValues, raw: string): number | null | undefined => {
    const n = parseNumberInput(raw);
    if (n === undefined) return mode === "edit" ? null : undefined;
    if (Number.isNaN(n)) {
      errors[key] = "فقط عدد صحیح وارد کنید";
      return undefined;
    }
    return n;
  };
  const date = (key: keyof CouponFormValues, raw: string): string | null | undefined => {
    const iso = localInputToIso(raw);
    if (iso === "invalid") {
      errors[key] = "تاریخ معتبر نیست";
      return undefined;
    }
    if (iso === undefined) return mode === "edit" ? null : undefined;
    return iso;
  };

  const discountValue = parseNumberInput(values.discountValue);
  if (discountValue === undefined) errors.discountValue = "مقدار تخفیف را وارد کنید";
  else if (Number.isNaN(discountValue)) errors.discountValue = "فقط عدد صحیح وارد کنید";

  const body: Record<string, unknown> = {
    discountType: values.discountType,
    discountValue,
    // سقف تخفیف فقط برای درصدی معنا دارد؛ برای ثابت هرگز ارسال نمی‌شود
    maxDiscountAmount: values.discountType === "PERCENTAGE" ? num("maxDiscountAmount", values.maxDiscountAmount) : mode === "edit" ? null : undefined,
    minPurchaseAmount: num("minPurchaseAmount", values.minPurchaseAmount),
    startsAt: date("startsAt", values.startsAt),
    expiresAt: date("expiresAt", values.expiresAt),
    usageLimit: num("usageLimit", values.usageLimit),
    perUserLimit: num("perUserLimit", values.perUserLimit),
    sellerId: values.sellerId === "" ? (mode === "edit" ? null : undefined) : values.sellerId,
    productIds: values.products.map((p) => p.id),
    categoryIds: values.categoryIds,
    description: values.description.trim() === "" ? (mode === "edit" ? null : undefined) : values.description.trim(),
  };
  if (mode === "create") body.code = values.code;
  for (const key of Object.keys(body)) if (body[key] === undefined) delete body[key];
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, payload: body };
}

export function toCreatePayload(values: CouponFormValues): CouponPayloadResult<CreateCouponInput> {
  const built = buildBody(values, "create");
  if (!built.ok) return built;
  const parsed = createCouponSchema.safeParse(built.payload);
  if (!parsed.success) return { ok: false, errors: firstFieldErrors(parsed.error) };
  return { ok: true, payload: parsed.data };
}

export function toUpdatePayload(values: CouponFormValues): CouponPayloadResult<UpdateCouponInput> {
  const built = buildBody(values, "edit");
  if (!built.ok) return built;
  const parsed = updateCouponSchema.safeParse(built.payload);
  if (!parsed.success) return { ok: false, errors: firstFieldErrors(parsed.error) };
  // قانون بین‌فیلدی روی حالت کامل فرم (سرور هم روی حالت ادغام‌شده می‌سنجد)
  const full = createCouponSchema.safeParse({ ...built.payload, code: "PLACEHOLDER" });
  if (!full.success) {
    const errors = firstFieldErrors(full.error);
    delete errors.code;
    if (Object.keys(errors).length > 0) return { ok: false, errors };
  }
  return { ok: true, payload: parsed.data };
}
