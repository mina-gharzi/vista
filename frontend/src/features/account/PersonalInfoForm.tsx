"use client";

import { updateProfileSchema } from "@vista/shared";
import { useState, type FormEvent } from "react";
import { Button, Input, useToast } from "@/components/ui";
import { ApiRequestError } from "@/lib/api/client";
import { firstBackendErrors, firstFieldErrors } from "@/lib/utils/zod";
import { useAuth } from "@/features/auth/AuthProvider";

export function PersonalInfoForm() {
  const { user, updateProfile } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = updateProfileSchema.safeParse({ fullName, phone });
    if (!parsed.success) {
      setErrors(firstFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await updateProfile(parsed.data);
      toast({ title: "اطلاعات شما ذخیره شد", variant: "success" });
    } catch (error) {
      if (error instanceof ApiRequestError && error.details) {
        setErrors(firstBackendErrors(error.details));
      } else {
        toast({
          title: "ذخیره اطلاعات ناموفق بود",
          description: error instanceof ApiRequestError ? error.message : undefined,
          variant: "error",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex max-w-lg flex-col gap-5">
      <Input
        label="نام و نام خانوادگی"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        error={errors.fullName ?? ""}
        autoComplete="name"
        required
      />
      <Input label="ایمیل" value={user.email} dir="ltr" readOnly hint="ایمیل قابل تغییر نیست" />
      <Input
        label="شماره موبایل"
        type="tel"
        dir="ltr"
        placeholder="09123456789"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        error={errors.phone ?? ""}
        hint="برای حذف شماره، فیلد را خالی بگذارید"
        autoComplete="tel"
      />
      <div>
        <Button type="submit" loading={submitting}>
          ذخیره تغییرات
        </Button>
      </div>
    </form>
  );
}
