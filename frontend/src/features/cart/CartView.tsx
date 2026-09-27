"use client";

import type { CartSummary } from "@vista/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { cartApi } from "@/lib/api/cart";
import { formatPrice } from "@/lib/utils/format";
import { CartItemRow } from "./components/CartItemRow";

type LoadState = "loading" | "error" | "ready";

export function CartView() {
  const [cart, setCart] = useState<CartSummary | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  const load = () => {
    setState("loading");
    cartApi
      .get()
      .then((data) => {
        setCart(data);
        setState("ready");
      })
      .catch(() => setState("error"));
  };

  useEffect(load, []);

  if (state === "loading") {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (state === "error" || !cart) {
    return <ErrorState onRetry={load} />;
  }

  if (cart.items.length === 0) {
    return (
      <EmptyState
        title="سبد خرید شما خالی است"
        description="محصولی هنوز اضافه نکرده‌اید."
        action={
          <Link href="/products">
            <Button>مشاهده محصولات</Button>
          </Link>
        }
      />
    );
  }

  const hasUnavailable = cart.items.some((item) => !item.isAvailable);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <Card padding="lg">
        {cart.items.map((item) => (
          <CartItemRow key={item.variantId} item={item} onChange={setCart} />
        ))}
      </Card>

      <Card padding="lg" className="flex h-fit flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-ink-muted">جمع کل ({cart.itemCount} کالا)</span>
          <span className="type-price">{formatPrice(cart.subtotal)}</span>
        </div>
        {hasUnavailable && (
          <p className="text-sm text-danger">
            برای ادامه، کالاهای با موجودی ناکافی را از سبد حذف یا تعدادشان را اصلاح کنید.
          </p>
        )}
        {/* دکمه ادامه فرآیند خرید — در Feature «Checkout» اضافه می‌شود */}
      </Card>
    </div>
  );
}
