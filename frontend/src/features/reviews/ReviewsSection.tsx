"use client";

import type { ProductReviewsResult, ReviewSummary } from "@vista/shared";
import { useEffect, useState } from "react";
import { Button, ErrorState, Modal, Skeleton, useToast } from "@/components/ui";
import { RatingStars } from "@/components/product/RatingStars";
import { useAuth } from "@/features/auth/AuthProvider";
import { ApiRequestError } from "@/lib/api/client";
import { reviewsApi } from "@/lib/api/reviews";
import { ReviewForm } from "./ReviewForm";

type LoadState = "loading" | "error" | "ready";

function ReviewRow({
  review,
  onEdit,
  onDelete,
}: {
  review: ReviewSummary;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-border py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="type-label">{review.userName}</span>
          <RatingStars average={review.rating} />
        </div>
        {review.isMine && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="text-sm text-bordeaux hover:underline"
            >
              ویرایش
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="text-sm text-danger hover:underline"
            >
              حذف
            </button>
          </div>
        )}
      </div>
      {review.comment && <p className="text-sm text-ink-muted">{review.comment}</p>}
    </div>
  );
}

export function ReviewsSection({ productId }: { productId: string }) {
  const { status } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useState<LoadState>("loading");
  const [result, setResult] = useState<ProductReviewsResult | null>(null);
  const [writing, setWriting] = useState(false);
  const [editingReview, setEditingReview] = useState<ReviewSummary | null>(null);
  const [deletingReview, setDeletingReview] = useState<ReviewSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setState("loading");
    reviewsApi
      .listForProduct(productId)
      .then((data) => {
        setResult(data);
        setState("ready");
      })
      .catch(() => setState("error"));
  };

  useEffect(load, [productId]);

  const myReview = result?.reviews.find((r) => r.isMine);

  const handleSaved = () => {
    setWriting(false);
    setEditingReview(null);
    load();
    toast({ title: "نظر شما ثبت شد", variant: "success" });
  };

  const confirmDelete = async () => {
    if (!deletingReview) return;
    setBusy(true);
    try {
      await reviewsApi.remove(deletingReview.id);
      setDeletingReview(null);
      load();
      toast({ title: "نظر حذف شد", variant: "success" });
    } catch (error) {
      toast({
        title: "حذف ناموفق بود",
        description: error instanceof ApiRequestError ? error.message : undefined,
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (state === "error" || !result) {
    return <ErrorState onRetry={load} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="type-h3">نظرات مشتریان</h2>
        {result.count > 0 && (
          <RatingStars average={result.average} count={result.count} size="md" />
        )}
      </div>

      {status === "authenticated" && !myReview && !writing && (
        <Button variant="secondary" onClick={() => setWriting(true)} className="w-fit">
          ثبت نظر
        </Button>
      )}

      {writing && (
        <ReviewForm
          productId={productId}
          onSaved={handleSaved}
          onCancel={() => setWriting(false)}
        />
      )}

      {editingReview && (
        <ReviewForm
          productId={productId}
          existing={editingReview}
          onSaved={handleSaved}
          onCancel={() => setEditingReview(null)}
        />
      )}

      {result.reviews.length === 0 ? (
        <p className="text-sm text-ink-muted">هنوز نظری برای این محصول ثبت نشده است.</p>
      ) : (
        <div>
          {result.reviews.map((review) => (
            <ReviewRow
              key={review.id}
              review={review}
              onEdit={() => setEditingReview(review)}
              onDelete={() => setDeletingReview(review)}
            />
          ))}
        </div>
      )}

      <Modal
        open={deletingReview !== null}
        onClose={() => setDeletingReview(null)}
        title="حذف نظر"
        description="این نظر برای همیشه حذف می‌شود."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeletingReview(null)}>
              انصراف
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void confirmDelete()}>
              حذف
            </Button>
          </>
        }
      />
    </div>
  );
}
