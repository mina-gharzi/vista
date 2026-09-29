"use client";

import { useEffect, useState } from "react";
import { Spinner, useToast } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { ApiRequestError } from "@/lib/api/client";
import { wishlistApi } from "@/lib/api/wishlist";
import { cn } from "@/lib/utils/cn";

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 20.5s-7.5-4.6-10-9.2C.5 8 2 4.5 5.5 4a5 5 0 0 1 6.5 2.5A5 5 0 0 1 18.5 4c3.5.5 5 4 3.5 7.3-2.5 4.6-10 9.2-10 9.2Z"
      />
    </svg>
  );
}

/** دکمه افزودن/حذف از علاقه‌مندی‌ها. برای مهمان نمایش داده نمی‌شود (نیازمند ورود است). */
export function WishlistButton({ productId }: { productId: string }) {
  const { status } = useAuth();
  const { toast } = useToast();
  const [wishlisted, setWishlisted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(false);
      return;
    }
    wishlistApi
      .getStatus(productId)
      .then((result) => setWishlisted(result.isWishlisted))
      .catch(() => {
        // خطای شبکه هنگام بررسی وضعیت اولیه بی‌اهمیت است؛ کاربر می‌تواند دوباره کلیک کند
      })
      .finally(() => setLoading(false));
  }, [status, productId]);

  if (status !== "authenticated") return null;

  const toggle = async () => {
    if (pending) return;
    setPending(true);
    const next = !wishlisted;
    setWishlisted(next); // به‌روزرسانی خوش‌بینانه
    try {
      if (next) await wishlistApi.add(productId);
      else await wishlistApi.remove(productId);
    } catch (error) {
      setWishlisted(!next); // بازگشت در صورت خطا
      toast({
        title: "خطایی رخ داد",
        description: error instanceof ApiRequestError ? error.message : undefined,
        variant: "error",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={loading}
      aria-pressed={wishlisted}
      aria-label={wishlisted ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded border transition-colors",
        wishlisted
          ? "border-bordeaux text-bordeaux"
          : "border-ink-faint text-ink-muted hover:border-ink",
      )}
    >
      {loading ? <Spinner size="sm" /> : <HeartIcon filled={wishlisted} />}
    </button>
  );
}
