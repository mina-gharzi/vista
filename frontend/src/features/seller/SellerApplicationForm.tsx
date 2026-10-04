"use client";

import { applySellerSchema, type ApplySellerInput, type SellerApplication } from "@vista/shared";
import { useRef, useState, type FormEvent } from "react";
import { Button, Input, Textarea, useToast } from "@/components/ui";
import { FormError } from "@/features/auth/components/FormError";
import { ApiRequestError } from "@/lib/api/client";
import { sellerApi } from "@/lib/api/seller";
import { firstBackendErrors, firstFieldErrors } from "@/lib/utils/zod";

interface SellerApplicationFormProps {
  initialValues?: Pick<SellerApplication, "storeName" | "storeSlug" | "description">;
  onSubmitted: () => void;
  /** وضعیت سمت سرور عوض شده (مثلاً درخواست تکراری)؛ والد باید وضعیت را دوباره بخواند */
  onStale: () => void;
}

const GENERIC_ERROR = "ثبت درخواست انجام نشد. لطفاً دوباره تلاش کنید.";

export function SellerApplicationForm({
  initialValues,
  onSubmitted,
  onStale,
}: SellerApplicationFormProps) {
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  // قفل همزمان: state با تأخیر به‌روز می‌شود، ref کلیک دوم را همان لحظه رد می‌کند
  const inFlight = useRef(false);

  const [storeName, setStoreName] = useState(initialValues?.storeName ?? "");
  const [storeSlug, setStoreSlug] = useState(initialValues?.storeSlug ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const focusFirstError = () => {
    requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    setFormError(null);

    // اعتبارسنجی Client فقط برای UX است؛ Backend مرجع نهایی است
    const parsed = applySellerSchema.safeParse({ storeName, storeSlug, description });
    if (!parsed.success) {
      setFieldErrors(firstFieldErrors(parsed.error));
      focusFirstError();
      return;
    }
    setFieldErrors({});

    inFlight.current = true;
    setSubmitting(true);
    try {
      const input: ApplySellerInput = parsed.data;
      await sellerApi.apply(input);
      toast({ title: "درخواست فروشندگی شما ثبت شد", variant: "success" });
      onSubmitted();
    } catch (error) {
      if (error instanceof ApiRequestError) {
        const backendErrors = firstBackendErrors(error.details);
        if (Object.keys(backendErrors).length > 0) {
          setFieldErrors(backendErrors);
          focusFirstError();
        } else if (error.status === 409 || error.status === 403) {
          // درخواست تکراری / تعلیق / تغییر وضعیت: پیام فارسی Backend امن است و وضعیت را دوباره می‌خوانیم
          toast({ title: error.message, variant: "warning" });
          onStale();
        } else if (error.code === "NETWORK_ERROR") {
          setFormError(error.message);
        } else if (error.status === 401) {
          setFormError("نشست شما منقضی شده است. دوباره وارد شوید.");
        } else {
          // پیام خام سرور (مثلاً 5xx/429) نمایش داده نمی‌شود
          setFormError(error.status === 429 ? error.message : GENERIC_ERROR);
        }
      } else {
        setFormError(GENERIC_ERROR);
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <form ref={formRef} noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
      <FormError message={formError} />
      <Input
        label="نام فروشگاه"
        name="storeName"
        value={storeName}
        onChange={(event) => setStoreName(event.target.value)}
        error={fieldErrors.storeName ?? ""}
        maxLength={80}
        required
      />
      <Input
        label="شناسه فروشگاه (slug)"
        name="storeSlug"
        dir="ltr"
        autoComplete="off"
        placeholder="my-store"
        hint="فقط حروف انگلیسی کوچک، عدد و خط تیره؛ در آدرس فروشگاه شما استفاده می‌شود."
        value={storeSlug}
        onChange={(event) => setStoreSlug(event.target.value.toLowerCase())}
        error={fieldErrors.storeSlug ?? ""}
        maxLength={60}
        required
      />
      <Textarea
        label="توضیحات فروشگاه (اختیاری)"
        name="description"
        hint="حداکثر ۵۰۰ کاراکتر"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        error={fieldErrors.description ?? ""}
        maxLength={600}
      />
      <Button type="submit" size="lg" fullWidth loading={submitting}>
        ثبت درخواست فروشندگی
      </Button>
    </form>
  );
}
