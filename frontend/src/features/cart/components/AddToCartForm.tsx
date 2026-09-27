"use client";

import type { PublicProductVariant } from "@vista/shared";
import Link from "next/link";
import { useState } from "react";
import { Button, Select, useToast } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { cartApi } from "@/lib/api/cart";
import { ApiRequestError } from "@/lib/api/client";

export function AddToCartForm({ variants }: { variants: PublicProductVariant[] }) {
  const { status } = useAuth();
  const { toast } = useToast();
  const purchasable = variants.filter((v) => v.stock > 0);
  const [variantId, setVariantId] = useState(purchasable[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const selected = variants.find((v) => v.id === variantId);
  const maxQuantity = Math.min(selected?.stock ?? 1, 99);

  if (status === "loading") return null;

  if (status === "unauthenticated") {
    return (
      <p className="text-sm text-ink-muted">
        برای افزودن به سبد خرید ابتدا{" "}
        <Link href="/login" className="text-bordeaux underline underline-offset-4">
          وارد شوید
        </Link>
        .
      </p>
    );
  }

  if (purchasable.length === 0) {
    return <p className="text-sm text-danger">این کالا در حال حاضر ناموجود است.</p>;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!variantId || submitting) return;

    setSubmitting(true);
    try {
      await cartApi.addItem({ variantId, quantity });
      toast({ title: "به سبد خرید اضافه شد", variant: "success" });
    } catch (error) {
      const message =
        error instanceof ApiRequestError ? error.message : "خطایی رخ داد، دوباره تلاش کنید";
      toast({ title: "افزودن به سبد ناموفق بود", description: message, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="w-40">
        <Select
          label="سایز / رنگ"
          value={variantId}
          onChange={(event) => {
            setVariantId(event.target.value);
            setQuantity(1);
          }}
        >
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id} disabled={variant.stock === 0}>
              {variant.size} / {variant.color}
              {variant.stock === 0 ? " (ناموجود)" : ""}
            </option>
          ))}
        </Select>
      </div>
      <div className="w-24">
        <Select
          label="تعداد"
          value={String(quantity)}
          onChange={(event) => setQuantity(Number(event.target.value))}
        >
          {Array.from({ length: maxQuantity }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" loading={submitting}>
        افزودن به سبد خرید
      </Button>
    </form>
  );
}
