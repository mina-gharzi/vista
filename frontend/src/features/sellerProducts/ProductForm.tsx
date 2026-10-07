"use client";

import {
  createProductSchema,
  updateProductSchema,
  type CreateProductInput,
  type SellerProduct,
  type UpdateProductInput,
} from "@vista/shared";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";
import { FormError } from "@/features/auth/components/FormError";
import { parseNumberInput } from "@/lib/utils/digits";
import { firstFieldErrors } from "@/lib/utils/zod";
import { describeProductError } from "./productErrors";
import { ProductImagesEditor, type ImageDraft } from "./ProductImagesEditor";
import type { CategoryOption } from "./useCategoryOptions";

interface VariantDraft {
  size: string;
  color: string;
  stock: string;
  price: string;
}

type ProductFormProps = {
  categories: CategoryOption[];
  categoriesFailed?: boolean;
} & (
  | { mode: "create"; onSubmit: (input: CreateProductInput) => Promise<void> }
  | { mode: "edit"; product: SellerProduct; onSubmit: (input: UpdateProductInput) => Promise<void> }
);

const emptyVariant = (): VariantDraft => ({ size: "", color: "", stock: "0", price: "" });

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = `section-${title.replace(/\s+/g, "-")}`;
  return (
    <Card as="section" aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="type-h3">
        {title}
      </h2>
      {children}
    </Card>
  );
}

export function ProductForm(props: ProductFormProps) {
  const { categories, categoriesFailed, mode } = props;
  const product = props.mode === "edit" ? props.product : null;

  const formRef = useRef<HTMLFormElement>(null);
  const inFlight = useRef(false);

  const [title, setTitle] = useState(product?.title ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [basePrice, setBasePrice] = useState(product ? String(product.basePrice) : "");
  const [compareAtPrice, setCompareAtPrice] = useState(
    product?.compareAtPrice != null ? String(product.compareAtPrice) : "",
  );
  const [images, setImages] = useState<ImageDraft[]>(
    product?.images.map((image) => ({ url: image.url, altText: image.altText ?? "" })) ?? [],
  );
  const [variants, setVariants] = useState<VariantDraft[]>([emptyVariant()]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const slugLocked = product?.status === "PUBLISHED";

  const focusFirstError = () => {
    requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
  };

  const imagePayload = images.map((image) => ({
    url: image.url,
    ...(image.altText.trim() ? { altText: image.altText.trim() } : {}),
  }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    setFormError(null);

    const price = parseNumberInput(basePrice);
    const compare = parseNumberInput(compareAtPrice);

    let errors: Record<string, string> = {};
    let run: (() => Promise<void>) | null = null;

    if (props.mode === "create") {
      const parsed = createProductSchema.safeParse({
        categoryId,
        title,
        ...(slug.trim() ? { slug } : {}),
        description,
        basePrice: price,
        ...(compare !== undefined ? { compareAtPrice: compare } : {}),
        images: imagePayload,
        variants: variants.map((variant) => ({
          size: variant.size,
          color: variant.color,
          stock: parseNumberInput(variant.stock) ?? 0,
          ...(parseNumberInput(variant.price) !== undefined
            ? { price: parseNumberInput(variant.price) }
            : {}),
        })),
      });
      if (!parsed.success) errors = firstFieldErrors(parsed.error);
      else run = () => props.onSubmit(parsed.data);
    } else {
      const parsed = updateProductSchema.safeParse({
        categoryId,
        title,
        description,
        basePrice: price,
        compareAtPrice: compare ?? null,
        images: imagePayload,
        ...(slug.trim() && !slugLocked ? { slug } : {}),
      });
      if (!parsed.success) errors = firstFieldErrors(parsed.error);
      else run = () => props.onSubmit(parsed.data);
    }

    if (!run) {
      // پیام فیلدهای تو در تو (variants.0.size) روی خود فیلد ردیف نمایش داده می‌شود
      setFieldErrors(errors);
      focusFirstError();
      return;
    }
    setFieldErrors({});

    inFlight.current = true;
    setSubmitting(true);
    try {
      await run();
    } catch (error) {
      const described = describeProductError(error);
      if (Object.keys(described.fieldErrors).length > 0) {
        setFieldErrors(described.fieldErrors);
        focusFirstError();
      }
      setFormError(described.message);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const updateVariant = (index: number, patch: Partial<VariantDraft>) =>
    setVariants((current) => current.map((v, i) => (i === index ? { ...v, ...patch } : v)));

  return (
    <form ref={formRef} noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FormError message={formError} />

      <Section title="اطلاعات اصلی">
        <Input
          label="نام محصول"
          name="title"
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          error={fieldErrors.title ?? ""}
          required
        />
        <Input
          label="شناسه محصول (slug)"
          name="slug"
          dir="ltr"
          autoComplete="off"
          placeholder="wool-coat"
          value={slug}
          disabled={slugLocked}
          onChange={(event) => setSlug(event.target.value.toLowerCase())}
          hint={
            slugLocked
              ? "برای تغییر شناسه، ابتدا انتشار محصول را لغو کنید."
              : mode === "create"
                ? "اختیاری؛ اگر خالی بماند به‌صورت خودکار ساخته می‌شود."
                : "فقط حروف انگلیسی کوچک، عدد و خط تیره."
          }
          error={fieldErrors.slug ?? ""}
          maxLength={80}
        />
        <Textarea
          label="توضیحات"
          name="description"
          rows={6}
          value={description}
          maxLength={5000}
          onChange={(event) => setDescription(event.target.value)}
          error={fieldErrors.description ?? ""}
          required
        />
      </Section>

      <Section title="دسته‌بندی">
        <Select
          label="دسته‌بندی محصول"
          name="categoryId"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          error={fieldErrors.categoryId ?? (categoriesFailed ? "دریافت دسته‌بندی‌ها انجام نشد" : "")}
          required
        >
          <option value="">انتخاب کنید…</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </Select>
      </Section>

      <Section title="قیمت">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="قیمت (تومان)"
            name="basePrice"
            inputMode="numeric"
            dir="ltr"
            value={basePrice}
            onChange={(event) => setBasePrice(event.target.value)}
            error={fieldErrors.basePrice ?? ""}
            required
          />
          <Input
            label="قیمت قبل از تخفیف (اختیاری)"
            name="compareAtPrice"
            inputMode="numeric"
            dir="ltr"
            hint="باید بیشتر از قیمت فعلی باشد."
            value={compareAtPrice}
            onChange={(event) => setCompareAtPrice(event.target.value)}
            error={fieldErrors.compareAtPrice ?? ""}
          />
        </div>
      </Section>

      <Section title="تصاویر">
        <ProductImagesEditor images={images} onChange={setImages} error={fieldErrors.images} />
      </Section>

      <Section title="تنوع‌ها (سایز و رنگ)">
        {props.mode === "create" ? (
          <>
            {fieldErrors.variants && (
              <p role="alert" className="text-sm text-danger">
                {fieldErrors.variants}
              </p>
            )}
            <ul className="flex flex-col gap-4">
              {variants.map((variant, index) => (
                <li key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                  <Input
                    label={`سایز (تنوع ${index + 1})`}
                    name={`variant-size-${index}`}
                    value={variant.size}
                    onChange={(event) => updateVariant(index, { size: event.target.value })}
                    error={fieldErrors[`variants.${index}.size`] ?? ""}
                  />
                  <Input
                    label={`رنگ (تنوع ${index + 1})`}
                    name={`variant-color-${index}`}
                    value={variant.color}
                    onChange={(event) => updateVariant(index, { color: event.target.value })}
                    error={fieldErrors[`variants.${index}.color`] ?? ""}
                  />
                  <Input
                    label={`موجودی (تنوع ${index + 1})`}
                    name={`variant-stock-${index}`}
                    inputMode="numeric"
                    dir="ltr"
                    value={variant.stock}
                    onChange={(event) => updateVariant(index, { stock: event.target.value })}
                    error={fieldErrors[`variants.${index}.stock`] ?? ""}
                  />
                  <Button
                    variant="ghost"
                    aria-label={`حذف تنوع ${index + 1}`}
                    disabled={variants.length === 1}
                    onClick={() => setVariants((current) => current.filter((_, i) => i !== index))}
                  >
                    حذف
                  </Button>
                </li>
              ))}
            </ul>
            <div>
              <Button
                variant="secondary"
                disabled={variants.length >= 50}
                onClick={() => setVariants((current) => [...current, emptyVariant()])}
              >
                افزودن تنوع
              </Button>
            </div>
          </>
        ) : (
          <>
            <ul className="flex flex-wrap gap-2" aria-label="تنوع‌های فعلی">
              {props.product.variants.map((variant) => (
                <li key={variant.id} className="rounded border border-border bg-ivory px-3 py-1.5 text-sm">
                  {variant.size} / {variant.color}
                </li>
              ))}
            </ul>
            <p className="type-caption">
              ویرایش تنوع‌ها و موجودی در بخش «مدیریت تنوع و موجودی» (مرحله بعد) انجام می‌شود.
            </p>
          </>
        )}
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={submitting} size="lg">
          {mode === "create" ? "ذخیره به‌عنوان پیش‌نویس" : "ذخیره تغییرات"}
        </Button>
      </div>
    </form>
  );
}
