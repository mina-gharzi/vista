"use client";

import { useRef, useState, type FormEvent } from "react";
import { ApiRequestError } from "@/lib/api/client";
import { firstBackendErrors } from "@/lib/utils/zod";

interface UseAuthFormOptions<T> {
  /** اعتبارسنجی سمت Client (فقط برای UX؛ Backend مرجع نهایی است) */
  validate: (values: T) => Record<string, string>;
  submit: (values: T) => Promise<void>;
  onSuccess: () => void;
}

/** State و رفتار مشترک فرم‌های ورود/ثبت‌نام: خطای فیلدها، خطای کلی، Loading و Focus روی اولین خطا. */
export function useAuthForm<T>({ validate, submit, onSuccess }: UseAuthFormOptions<T>) {
  const formRef = useRef<HTMLFormElement>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const focusFirstError = () => {
    // بعد از رندر خطاها، فیلد نامعتبر اول Focus می‌گیرد (Accessibility)
    requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
  };

  const handleSubmit = (values: T) => async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setFormError(null);

    const clientErrors = validate(values);
    setFieldErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) {
      focusFirstError();
      return;
    }

    setSubmitting(true);
    try {
      await submit(values);
      onSuccess();
    } catch (error) {
      if (error instanceof ApiRequestError) {
        const backendErrors = firstBackendErrors(error.details);
        if (Object.keys(backendErrors).length > 0) {
          setFieldErrors(backendErrors);
          focusFirstError();
        } else if (error.code === "CONFLICT_ERROR") {
          setFieldErrors({ email: error.message });
          focusFirstError();
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError("خطای غیرمنتظره‌ای رخ داد. دوباره تلاش کنید.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return { formRef, fieldErrors, formError, submitting, handleSubmit };
}
