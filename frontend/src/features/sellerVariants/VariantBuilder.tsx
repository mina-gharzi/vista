"use client";

import type { ProductVariantSummary, SellerProduct } from "@vista/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Input,
  Skeleton,
  useToast,
} from "@/components/ui";
import { FormError } from "@/features/auth/components/FormError";
import { describeProductError } from "@/features/sellerProducts/productErrors";
import { ApiRequestError } from "@/lib/api/client";
import { sellerVariantsApi } from "@/lib/api/sellerVariants";
import { formatNumber, formatPrice } from "@/lib/utils/format";
import { ChipInput } from "./ChipInput";
import {
  draftFromVariant,
  generateCombinations,
  PRESET_COLORS,
  PRESET_SIZES,
  toSyncPayload,
  validateDrafts,
  type DraftErrors,
  type VariantDraft,
} from "./variantDraft";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; archivedCount: number };

const ROW_GRID =
  "md:grid md:grid-cols-[1.1fr_0.8fr_1.4fr_1.1fr_0.9fr_auto] md:items-start md:gap-3";

const unique = (values: string[]) =>
  values.filter((value, index) => values.findIndex((v) => v.toLowerCase() === value.toLowerCase()) === index);

const snapshot = (drafts: VariantDraft[]) =>
  JSON.stringify(drafts.map(({ id, color, size, sku, price, stock }) => [id, color, size, sku, price, stock]));

function MobileCaption({ children }: { children: string }) {
  return (
    <span aria-hidden="true" className="type-caption md:hidden">
      {children}
    </span>
  );
}

interface VariantBuilderProps {
  product: Pick<SellerProduct, "id" | "slug" | "basePrice" | "status">;
  /** پس از ذخیره موفق، فهرست جدید تنوع‌های فعال */
  onSaved?: (variants: ProductVariantSummary[]) => void;
}

/**
 * Variant Builder: رنگ‌ها و سایزها را انتخاب می‌کنید، ترکیب‌ها در کلاینت ساخته می‌شود و فقط با «ذخیره»
 * (یک درخواست اتمیک) پایدار می‌شود. موجودی تنوع‌های موجود اینجا ویرایش نمی‌شود (فاز مدیریت موجودی).
 */
export function VariantBuilder({ product, onSaved }: VariantBuilderProps) {
  const { toast } = useToast();
  const inFlight = useRef(false);
  const listRef = useRef<HTMLUListElement>(null);

  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [drafts, setDrafts] = useState<VariantDraft[]>([]);
  const [saved, setSaved] = useState("[]");
  const [colors, setColors] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [validated, setValidated] = useState(false);
  const [saving, setSaving] = useState(false);

  const applyServerList = useCallback((list: ProductVariantSummary[]) => {
    const active = list.filter((variant) => variant.isActive);
    const next = active.map(draftFromVariant);
    setDrafts(next);
    setSaved(snapshot(next));
    setColors(unique(active.map((v) => v.color)));
    setSizes(unique(active.map((v) => v.size)));
    return list.length - active.length;
  }, []);

  const fetchVariants = useCallback(() => {
    setLoad({ status: "loading" });
    sellerVariantsApi
      .list(product.id)
      .then((list) => setLoad({ status: "ready", archivedCount: applyServerList(list) }))
      .catch(() => setLoad({ status: "error" }));
  }, [product.id, applyServerList]);

  useEffect(fetchVariants, [fetchVariants]);

  const dirty = useMemo(() => snapshot(drafts) !== saved, [drafts, saved]);

  // پس از اولین تلاش برای ذخیره، خطاها هنگام ویرایش زنده به‌روز می‌شوند
  useEffect(() => {
    if (validated) setErrors(validateDrafts(drafts));
  }, [drafts, validated]);

  const update = (key: string, patch: Partial<VariantDraft>) =>
    setDrafts((current) => current.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)));

  const generate = () => {
    const added = generateCombinations(colors, sizes, drafts, product.slug);
    if (added.length === 0) {
      toast({
        title: colors.length === 0 || sizes.length === 0 ? "ابتدا حداقل یک رنگ و یک سایز اضافه کنید" : "همه ترکیب‌ها از قبل وجود دارند",
        variant: "info",
      });
      return;
    }
    setDrafts((current) => [...current, ...added]);
  };

  const focusFirstError = () => {
    requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
  };

  const save = async () => {
    if (inFlight.current) return;
    setFormError(null);
    setValidated(true);
    const found = validateDrafts(drafts);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirstError();
      return;
    }

    inFlight.current = true;
    setSaving(true);
    try {
      const list = await sellerVariantsApi.sync(product.id, toSyncPayload(drafts));
      const archivedCount = applyServerList(list);
      setLoad({ status: "ready", archivedCount });
      setValidated(false);
      setErrors({});
      toast({ title: "تنوع‌ها ذخیره شد", variant: "success" });
      onSaved?.(list.filter((variant) => variant.isActive));
    } catch (error) {
      const described = describeProductError(error);
      // خطای روی ردیف: «variants.<index>.<field>» به ردیف متناظر وصل می‌شود
      const rowErrors: DraftErrors = {};
      if (error instanceof ApiRequestError) {
        for (const [path, messages] of Object.entries(error.details ?? {})) {
          const match = /^variants\.(\d+)\.(color|size|sku|price|stock)$/.exec(path);
          const row = match ? drafts[Number(match[1])] : undefined;
          if (match && row && messages[0]) {
            rowErrors[row.key] = { ...rowErrors[row.key], [match[2] as "color"]: messages[0] };
          }
        }
      }
      if (Object.keys(rowErrors).length > 0) {
        setErrors(rowErrors);
        focusFirstError();
      }
      setFormError(described.message);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  const title = (
    <h2 id="variants-title" className="type-h3">
      تنوع‌ها (رنگ و سایز)
    </h2>
  );

  if (load.status === "loading") {
    return (
      <Card as="section" aria-labelledby="variants-title" className="flex flex-col gap-4">
        {title}
        <div aria-busy="true" aria-label="در حال بارگذاری تنوع‌ها" className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Card>
    );
  }
  if (load.status === "error") {
    return (
      <Card as="section" aria-labelledby="variants-title">
        {title}
        <ErrorState description="دریافت تنوع‌ها انجام نشد." onRetry={fetchVariants} />
      </Card>
    );
  }

  const editable = product.status !== "ARCHIVED";

  return (
    <Card as="section" aria-labelledby="variants-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        {title}
        <p className="text-sm text-ink-muted">
          رنگ و سایزها را انتخاب کنید، ترکیب‌ها را بسازید و SKU و قیمت هر کدام را تنظیم کنید. تا زمانی که
          «ذخیره تنوع‌ها» را نزنید چیزی ثبت نمی‌شود.
        </p>
      </div>

      {editable && (
        <div className="grid gap-6 md:grid-cols-2">
          <ChipInput label="رنگ‌ها" noun="رنگ" values={colors} presets={PRESET_COLORS} onChange={setColors} />
          <ChipInput
            label="سایزها"
            noun="سایز"
            values={sizes}
            presets={PRESET_SIZES}
            onChange={setSizes}
            dir="ltr"
          />
        </div>
      )}

      {editable && (
        <div>
          <Button variant="secondary" onClick={generate}>
            ساخت ترکیب‌ها
          </Button>
        </div>
      )}

      <FormError message={formError} />

      {drafts.length === 0 ? (
        <p role="status" className="rounded border border-dashed border-border px-4 py-8 text-center text-ink-muted">
          هنوز تنوعی تعریف نشده است. رنگ و سایز را انتخاب و «ساخت ترکیب‌ها» را بزنید.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div aria-hidden="true" className={`hidden px-3 text-xs text-ink-muted ${ROW_GRID}`}>
            <span>رنگ</span>
            <span>سایز</span>
            <span>SKU</span>
            <span>قیمت (تومان)</span>
            <span>موجودی</span>
            <span>وضعیت / عملیات</span>
          </div>
          <ul ref={listRef} aria-label="فهرست تنوع‌ها" className="flex flex-col gap-3">
            {drafts.map((draft, index) => {
              const rowErrors = errors[draft.key] ?? {};
              const n = formatNumber(index + 1);
              return (
                <li key={draft.key}>
                  <div
                    role="group"
                    aria-label={`تنوع ${n}: ${draft.color} / ${draft.size}`}
                    className={`flex flex-col gap-3 rounded border border-border bg-ivory p-3 ${ROW_GRID}`}
                  >
                    <div className="flex flex-col gap-1">
                      <MobileCaption>رنگ</MobileCaption>
                      <Input
                        label={`رنگ تنوع ${n}`}
                        hideLabel
                        value={draft.color}
                        disabled={!editable}
                        onChange={(event) => update(draft.key, { color: event.target.value })}
                        error={rowErrors.color ?? ""}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <MobileCaption>سایز</MobileCaption>
                      <Input
                        label={`سایز تنوع ${n}`}
                        hideLabel
                        dir="ltr"
                        value={draft.size}
                        disabled={!editable}
                        onChange={(event) => update(draft.key, { size: event.target.value })}
                        error={rowErrors.size ?? ""}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <MobileCaption>SKU</MobileCaption>
                      <Input
                        label={`SKU تنوع ${n}`}
                        hideLabel
                        dir="ltr"
                        autoComplete="off"
                        placeholder="خودکار"
                        value={draft.sku}
                        disabled={!editable}
                        onChange={(event) => update(draft.key, { sku: event.target.value })}
                        error={rowErrors.sku ?? ""}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <MobileCaption>قیمت (تومان)</MobileCaption>
                      <Input
                        label={`قیمت تنوع ${n}`}
                        hideLabel
                        inputMode="numeric"
                        dir="ltr"
                        placeholder={formatPrice(product.basePrice)}
                        value={draft.price}
                        disabled={!editable}
                        onChange={(event) => update(draft.key, { price: event.target.value })}
                        error={rowErrors.price ?? ""}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <MobileCaption>موجودی</MobileCaption>
                      {draft.id === null ? (
                        <Input
                          label={`موجودی اولیه تنوع ${n}`}
                          hideLabel
                          inputMode="numeric"
                          dir="ltr"
                          value={draft.stock}
                          disabled={!editable}
                          onChange={(event) => update(draft.key, { stock: event.target.value })}
                          error={rowErrors.stock ?? ""}
                        />
                      ) : (
                        <span className="py-2.5 text-sm tabular-nums text-ink-muted">
                          {formatNumber(Number(draft.stock))}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 md:justify-start md:pt-1.5">
                      <Badge variant={draft.id === null ? "premium" : "success"}>
                        {draft.id === null ? "جدید" : "فعال"}
                      </Badge>
                      {editable && (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`حذف تنوع ${n}: ${draft.color} / ${draft.size}`}
                          onClick={() => setDrafts((current) => current.filter((d) => d.key !== draft.key))}
                        >
                          حذف
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="type-caption">
            تنوع حذف‌شده پس از ذخیره آرشیو می‌شود؛ تاریخچه سفارش‌ها و موجودی حفظ می‌شود و اگر دوباره بسازیدش همان
            رکورد فعال می‌شود. موجودی تنوع‌های موجود در بخش مدیریت موجودی (مرحله بعد) تغییر می‌کند.
            {load.archivedCount > 0 && ` (${formatNumber(load.archivedCount)} تنوع آرشیو شده)`}
          </p>
        </div>
      )}

      {editable && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} loading={saving} disabled={!dirty}>
            ذخیره تنوع‌ها
          </Button>
          {dirty && <span className="text-sm text-ink-muted">تغییرات ذخیره‌نشده دارید.</span>}
        </div>
      )}
    </Card>
  );
}
