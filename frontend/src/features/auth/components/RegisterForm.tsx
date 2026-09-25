"use client";

import { registerSchema, type RegisterInput } from "@vista/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { firstFieldErrors } from "@/lib/utils/zod";
import { useAuth } from "../AuthProvider";
import { FormError } from "./FormError";
import { useAuthForm } from "./useAuthForm";

export function RegisterForm({ nextPath }: { nextPath: string }) {
  const { register } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const { formRef, fieldErrors, formError, submitting, handleSubmit } = useAuthForm<{
    fullName: string;
    email: string;
    phone: string;
    password: string;
  }>({
    validate: (values) => {
      const result = registerSchema.safeParse(toInput(values));
      return result.success ? {} : firstFieldErrors(result.error);
    },
    submit: (values) => register(toInput(values)),
    onSuccess: () => router.replace(nextPath),
  });

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit({ fullName, email, phone, password })}
      className="flex flex-col gap-5"
    >
      <FormError message={formError} />
      <Input
        label="نام و نام خانوادگی"
        name="fullName"
        autoComplete="name"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        error={fieldErrors.fullName ?? ""}
        required
      />
      <Input
        label="ایمیل"
        type="email"
        name="email"
        dir="ltr"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldErrors.email ?? ""}
        required
      />
      <Input
        label="شماره موبایل (اختیاری)"
        type="tel"
        name="phone"
        dir="ltr"
        autoComplete="tel"
        placeholder="09123456789"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        error={fieldErrors.phone ?? ""}
      />
      <Input
        label="رمز عبور"
        type="password"
        name="password"
        dir="ltr"
        autoComplete="new-password"
        hint="حداقل ۸ کاراکتر شامل حرف بزرگ، حرف کوچک و عدد"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fieldErrors.password ?? ""}
        required
      />
      <Button type="submit" size="lg" fullWidth loading={submitting}>
        ساخت حساب کاربری
      </Button>
      <p className="text-center text-sm text-ink-muted">
        قبلاً ثبت‌نام کرده‌اید؟{" "}
        <Link
          href={`/login?next=${encodeURIComponent(nextPath)}`}
          className="text-bordeaux underline underline-offset-4"
        >
          ورود
        </Link>
      </p>
    </form>
  );
}

/** فیلد خالی موبایل اصلاً ارسال نمی‌شود (Schema فقط فرمت 09xxxxxxxxx را می‌پذیرد) */
function toInput(values: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}): RegisterInput {
  const phone = values.phone.trim();
  return {
    fullName: values.fullName,
    email: values.email,
    password: values.password,
    ...(phone ? { phone } : {}),
  };
}
