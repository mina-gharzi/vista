"use client";

import type { AddressInput } from "@vista/shared";
import { addressInputSchema } from "@vista/shared";
import { useState, type FormEvent } from "react";
import { Button, Checkbox, Input } from "@/components/ui";
import { addressesApi } from "@/lib/api/addresses";
import { ApiRequestError } from "@/lib/api/client";
import { firstBackendErrors, firstFieldErrors } from "@/lib/utils/zod";

interface AddressFormProps {
  onCreated: (input: AddressInput & { id: string }) => void;
  onCancel: () => void;
}

const emptyForm: AddressInput = {
  fullName: "",
  phone: "",
  province: "",
  city: "",
  postalCode: "",
  addressLine: "",
  isDefault: false,
};

export function AddressForm({ onCreated, onCancel }: AddressFormProps) {
  const [values, setValues] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setField = <K extends keyof AddressInput>(key: K, value: AddressInput[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const parsed = addressInputSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(firstFieldErrors(parsed.error));
      return;
    }
    setErrors({});

    setSubmitting(true);
    try {
      const created = await addressesApi.create(parsed.data);
      onCreated({ ...parsed.data, id: created.id });
    } catch (error) {
      if (error instanceof ApiRequestError) {
        const backendErrors = firstBackendErrors(error.details);
        if (Object.keys(backendErrors).length > 0) setErrors(backendErrors);
        else setFormError(error.message);
      } else {
        setFormError("خطایی رخ داد، دوباره تلاش کنید");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-border p-4"
    >
      {formError && <p className="text-sm text-danger">{formError}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="نام و نام خانوادگی گیرنده"
          value={values.fullName}
          onChange={(e) => setField("fullName", e.target.value)}
          error={errors.fullName ?? ""}
          required
        />
        <Input
          label="شماره موبایل"
          dir="ltr"
          placeholder="09123456789"
          value={values.phone}
          onChange={(e) => setField("phone", e.target.value)}
          error={errors.phone ?? ""}
          required
        />
        <Input
          label="استان"
          value={values.province}
          onChange={(e) => setField("province", e.target.value)}
          error={errors.province ?? ""}
          required
        />
        <Input
          label="شهر"
          value={values.city}
          onChange={(e) => setField("city", e.target.value)}
          error={errors.city ?? ""}
          required
        />
        <Input
          label="کد پستی"
          dir="ltr"
          value={values.postalCode}
          onChange={(e) => setField("postalCode", e.target.value)}
          error={errors.postalCode ?? ""}
          required
        />
      </div>
      <Input
        label="آدرس کامل"
        value={values.addressLine}
        onChange={(e) => setField("addressLine", e.target.value)}
        error={errors.addressLine ?? ""}
        required
      />
      <Checkbox
        label="این آدرس، آدرس پیش‌فرض من باشد"
        checked={values.isDefault}
        onChange={(e) => setField("isDefault", e.target.checked)}
      />
      <div className="flex gap-3">
        <Button type="submit" loading={submitting}>
          ذخیره آدرس
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          انصراف
        </Button>
      </div>
    </form>
  );
}
