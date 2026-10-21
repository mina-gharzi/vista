"use client";

import { COUPON_DISCOUNT_TYPE_LABEL, type CouponDiscountType } from "@vista/shared";
import { useRef, useState, type FormEvent } from "react";
import { Button, Card, Checkbox, Input, Select, Textarea } from "@/components/ui";
import { adminApi } from "@/lib/api/admin";
import { describeAdminError } from "../adminErrors";
import { useAdminQuery } from "../useAdminQuery";
import type { CouponFormValues, CouponPayloadResult } from "./couponFormModel";

interface Props<T> {
  mode: "create" | "edit";
  initial: CouponFormValues;
  toPayload: (values: CouponFormValues) => CouponPayloadResult<T>;
  onSubmit: (payload: T) => Promise<void>;
  submitLabel: string;
}

/** فرم مشترک ساخت/ویرایش. ارسال دوباره در حین درخواست با Ref + state ممنوع است. */
export function CouponForm<T>({ mode, initial, toPayload, onSubmit, submitLabel }: Props<T>) {
  const [values, setValues] = useState<CouponFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

  const sellers = useAdminQuery(() => adminApi.sellers({ status: "APPROVED", limit: 50 }), "coupon-sellers");
  const categories = useAdminQuery(() => adminApi.categories({ sort: "name" }), "coupon-categories");

  const [productQuery, setProductQuery] = useState("");
  const [found, setFound] = useState<{ id: string; title: string }[] | null>(null);
  const [searching, setSearching] = useState(false);

  const set = <K extends keyof CouponFormValues>(key: K, value: CouponFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const searchProducts = async () => {
    if (searching) return;
    setSearching(true);
    try {
      const result = await adminApi.products({
        q: productQuery.trim() || undefined,
        sellerId: values.sellerId || undefined,
        limit: 8,
      });
      setFound(result.data.map((p) => ({ id: p.id, title: p.title })));
    } catch {
      setFound([]);
    } finally {
      setSearching(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    setFormError(null);
    const result = toPayload(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    inFlight.current = true;
    setPending(true);
    try {
      await onSubmit(result.payload);
    } catch (e) {
      const described = describeAdminError(e);
      setErrors(described.fieldErrors);
      setFormError(described.message);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  const fieldError = (key: string) => (errors[key] === undefined ? {} : { error: errors[key] });

  const percentage = values.discountType === "PERCENTAGE";

  return (
    <form onSubmit={submit} noValidate aria-label="فرم کوپن" className="flex flex-col gap-5">
      {formError && (
        <p role="alert" className="rounded border border-danger bg-danger-tint p-3 text-sm text-danger">
          {formError}
        </p>
      )}

      <Card as="section" className="grid gap-4 sm:grid-cols-2">
        <Input
          label="کد کوپن"
          name="code"
          dir="ltr"
          autoComplete="off"
          required
          disabled={mode === "edit"}
          hint={mode === "edit" ? "کد پس از ساخت قابل تغییر نیست" : "حروف انگلیسی، رقم، - و _ (۳ تا ۳۲ کاراکتر)"}
          value={values.code}
          {...fieldError("code")}
          onChange={(e) => set("code", e.target.value)}
        />
        <Select
          label="نوع تخفیف"
          name="discountType"
          value={values.discountType}
          onChange={(e) => set("discountType", e.target.value as CouponDiscountType)}
        >
          {(Object.keys(COUPON_DISCOUNT_TYPE_LABEL) as CouponDiscountType[]).map((t) => (
            <option key={t} value={t}>
              {COUPON_DISCOUNT_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
        <Input
          label={percentage ? "درصد تخفیف" : "مبلغ تخفیف (تومان)"}
          name="discountValue"
          inputMode="numeric"
          autoComplete="off"
          required
          value={values.discountValue}
          {...fieldError("discountValue")}
          onChange={(e) => set("discountValue", e.target.value)}
        />
        {percentage && (
          <Input
            label="سقف تخفیف (تومان)"
            name="maxDiscountAmount"
            inputMode="numeric"
            autoComplete="off"
            hint="اختیاری"
            value={values.maxDiscountAmount}
            {...fieldError("maxDiscountAmount")}
            onChange={(e) => set("maxDiscountAmount", e.target.value)}
          />
        )}
        <Input
          label="حداقل خرید (تومان)"
          name="minPurchaseAmount"
          inputMode="numeric"
          autoComplete="off"
          hint="اختیاری؛ روی مجموع کالاهای مشمول سنجیده می‌شود"
          value={values.minPurchaseAmount}
          {...fieldError("minPurchaseAmount")}
          onChange={(e) => set("minPurchaseAmount", e.target.value)}
        />
        <div className="sm:col-span-2">
          <Textarea
            label="توضیح"
            name="description"
            hint="اختیاری"
            value={values.description}
            {...fieldError("description")}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>
      </Card>

      <Card as="section" className="grid gap-4 sm:grid-cols-2">
        <Input
          label="شروع"
          name="startsAt"
          type="datetime-local"
          dir="ltr"
          hint="اختیاری"
          value={values.startsAt}
          {...fieldError("startsAt")}
          onChange={(e) => set("startsAt", e.target.value)}
        />
        <Input
          label="پایان"
          name="expiresAt"
          type="datetime-local"
          dir="ltr"
          hint="اختیاری"
          value={values.expiresAt}
          {...fieldError("expiresAt")}
          onChange={(e) => set("expiresAt", e.target.value)}
        />
        <Input
          label="سقف کل استفاده"
          name="usageLimit"
          inputMode="numeric"
          autoComplete="off"
          hint="خالی = نامحدود"
          value={values.usageLimit}
          {...fieldError("usageLimit")}
          onChange={(e) => set("usageLimit", e.target.value)}
        />
        <Input
          label="سقف هر مشتری"
          name="perUserLimit"
          inputMode="numeric"
          autoComplete="off"
          hint="خالی = نامحدود"
          value={values.perUserLimit}
          {...fieldError("perUserLimit")}
          onChange={(e) => set("perUserLimit", e.target.value)}
        />
      </Card>

      <Card as="section" aria-labelledby="coupon-scope" className="flex flex-col gap-4">
        <h2 id="coupon-scope" className="type-h3">
          محدودیت‌ها (اختیاری)
        </h2>
        <p className="text-sm text-ink-muted">
          فروشنده با محصول/دسته به‌صورت «و» ترکیب می‌شود؛ محصول و دسته با هم «یا». بدون محدودیت = کل سبد.
        </p>
        <Select
          label="فقط یک فروشنده"
          name="sellerId"
          value={values.sellerId}
          {...fieldError("sellerId")}
          onChange={(e) => set("sellerId", e.target.value)}
        >
          <option value="">همهٔ فروشندگان</option>
          {sellers.state.status === "ready" &&
            sellers.state.data.data.map((s) => (
              <option key={s.id} value={s.id}>
                {s.storeName}
              </option>
            ))}
        </Select>

        <fieldset className="flex flex-col gap-2">
          <legend className="type-label">دسته‌بندی‌ها</legend>
          {errors.categoryIds && <p className="text-sm text-danger">{errors.categoryIds}</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            {categories.state.status === "ready" &&
              categories.state.data.map((c) => (
                <Checkbox
                  key={c.id}
                  label={c.name}
                  checked={values.categoryIds.includes(c.id)}
                  onChange={(e) =>
                    set(
                      "categoryIds",
                      e.target.checked ? [...values.categoryIds, c.id] : values.categoryIds.filter((id) => id !== c.id),
                    )
                  }
                />
              ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <span className="type-label">محصولات</span>
          {errors.productIds && <p className="text-sm text-danger">{errors.productIds}</p>}
          {values.products.length > 0 && (
            <ul aria-label="محصولات انتخاب‌شده" className="flex flex-wrap gap-2">
              {values.products.map((p) => (
                <li key={p.id} className="flex items-center gap-2 rounded-full border border-border bg-ivory-soft px-3 py-1 text-sm">
                  {p.title}
                  <button
                    type="button"
                    aria-label={`حذف ${p.title}`}
                    className="text-danger"
                    onClick={() => set("products", values.products.filter((x) => x.id !== p.id))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <Input
              label="جستجوی محصول"
              name="productQuery"
              autoComplete="off"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void searchProducts();
                }
              }}
            />
            <Button type="button" variant="secondary" loading={searching} onClick={() => void searchProducts()}>
              جستجو
            </Button>
          </div>
          {found !== null &&
            (found.length === 0 ? (
              <p className="text-sm text-ink-muted">محصولی پیدا نشد.</p>
            ) : (
              <ul aria-label="نتایج جستجوی محصول" className="flex flex-col gap-1">
                {found.map((p) => {
                  const chosen = values.products.some((x) => x.id === p.id);
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                      <span>{p.title}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={chosen}
                        onClick={() => set("products", [...values.products, p])}
                      >
                        {chosen ? "افزوده شد" : "افزودن"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ))}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" loading={pending} disabled={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
