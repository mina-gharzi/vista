"use client";

import type { ReviewInput, ReviewSummary } from "@vista/shared";
import { reviewInputSchema } from "@vista/shared";
import { useState, type FormEvent } from "react";
import { Button, Select, Textarea } from "@/components/ui";
import { ApiRequestError } from "@/lib/api/client";
import { reviewsApi } from "@/lib/api/reviews";
import { firstBackendErrors, firstFieldErrors } from "@/lib/utils/zod";

interface ReviewFormProps {
  productId: string;
  /** اگر داده شود، فرم در حالت ویرایش نظر موجود است */
  existing?: ReviewSummary;
  onSaved: () => void;
  onCancel?: () => void;
}

export function ReviewForm({ productId, existing, onSaved, onCancel }: ReviewFormProps) {
  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const input: ReviewInput = { rating, ...(comment.trim() ? { comment: comment.trim() } : {}) };
    const parsed = reviewInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(firstFieldErrors(parsed.error));
      return;
    }
    setErrors({});

    setSubmitting(true);
    try {
      if (existing) await reviewsApi.update(existing.id, parsed.data);
      else await reviewsApi.create(productId, parsed.data);
      onSaved();
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
      <div className="w-32">
        <Select
          label="امتیاز"
          value={String(rating)}
          onChange={(e) => setRating(Number(e.target.value))}
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} ستاره
            </option>
          ))}
        </Select>
      </div>
      <Textarea
        label="نظر شما (اختیاری)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        error={errors.comment ?? ""}
        rows={3}
      />
      <div className="flex gap-3">
        <Button type="submit" loading={submitting}>
          {existing ? "ذخیره ویرایش" : "ثبت نظر"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            انصراف
          </Button>
        )}
      </div>
    </form>
  );
}
