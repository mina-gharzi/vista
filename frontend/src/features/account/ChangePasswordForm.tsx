"use client";

import { changePasswordSchema } from "@vista/shared";
import { useState, type FormEvent } from "react";
import { Button, Input, useToast } from "@/components/ui";
import { ApiRequestError } from "@/lib/api/client";
import { firstBackendErrors, firstFieldErrors } from "@/lib/utils/zod";
import { useAuth } from "@/features/auth/AuthProvider";

export function ChangePasswordForm() {
  const { changePassword } = useAuth();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword });
    if (!parsed.success) {
      setErrors(firstFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await changePassword(parsed.data);
      setCurrentPassword("");
      setNewPassword("");
      toast({
        title: "رمز عبور تغییر کرد",
        description: "از سایر دستگاه‌ها خارج شدید.",
        variant: "success",
      });
    } catch (error) {
      if (error instanceof ApiRequestError && error.details) {
        setErrors(firstBackendErrors(error.details));
      } else {
        toast({
          title: "تغییر رمز ناموفق بود",
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
        label="رمز عبور فعلی"
        type="password"
        dir="ltr"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        error={errors.currentPassword ?? ""}
        required
      />
      <Input
        label="رمز عبور جدید"
        type="password"
        dir="ltr"
        autoComplete="new-password"
        hint="حداقل ۸ کاراکتر شامل حرف بزرگ، حرف کوچک و عدد"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        error={errors.newPassword ?? ""}
        required
      />
      <div>
        <Button type="submit" loading={submitting}>
          تغییر رمز عبور
        </Button>
      </div>
    </form>
  );
}
