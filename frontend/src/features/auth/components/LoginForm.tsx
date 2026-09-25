"use client";

import { loginSchema, type LoginInput } from "@vista/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { firstFieldErrors } from "@/lib/utils/zod";
import { useAuth } from "../AuthProvider";
import { FormError } from "./FormError";
import { useAuthForm } from "./useAuthForm";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { formRef, fieldErrors, formError, submitting, handleSubmit } = useAuthForm<LoginInput>({
    validate: (values) => {
      const result = loginSchema.safeParse(values);
      return result.success ? {} : firstFieldErrors(result.error);
    },
    // ایمیل توسط Backend/Schema به حروف کوچک نرمال می‌شود
    submit: (values) =>
      login({ email: values.email.trim().toLowerCase(), password: values.password }),
    onSuccess: () => router.replace(nextPath),
  });

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit({ email, password })}
      className="flex flex-col gap-5"
    >
      <FormError message={formError} />
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
        label="رمز عبور"
        type="password"
        name="password"
        dir="ltr"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fieldErrors.password ?? ""}
        required
      />
      <Button type="submit" size="lg" fullWidth loading={submitting}>
        ورود
      </Button>
      <p className="text-center text-sm text-ink-muted">
        حساب کاربری ندارید؟{" "}
        <Link
          href={`/register?next=${encodeURIComponent(nextPath)}`}
          className="text-bordeaux underline underline-offset-4"
        >
          ثبت‌نام
        </Link>
      </p>
    </form>
  );
}
