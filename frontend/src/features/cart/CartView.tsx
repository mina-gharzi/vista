"use client";

import type { CartSummary } from "@vista/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { cartApi } from "@/lib/api/cart";
import { formatPrice } from "@/lib/utils/format";
import { CouponBox } from "@/features/coupons/CouponBox";
import { cartSignature, useCoupon } from "@/features/coupons/useCoupon";
import { CartItemRow } from "./components/CartItemRow";

type LoadState = "loading" | "error" | "ready";

export function CartView() {
  const [cart, setCart] = useState<CartSummary | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  // کوپن با هر تغییر سبد دوباره از سرور اعتبارسنجی می‌شود (کد با sessionStorage به Checkout هم می‌رسد)
  const coupon = useCoupon(cart ? cartSignature(cart.items) : "");

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
  const applied = coupon.applied;
  const payable = applied ? applied.totalAmount : cart.subtotal;

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
        <CouponBox coupon={coupon} />
        {applied && (
          <div className="flex items-center justify-between text-sm text-success">
            <span>تخفیف ({applied.code})</span>
            <span>−{formatPrice(applied.discountAmount)}</span>
          </div>
        )}
        {applied && (
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="type-label">مبلغ قابل پرداخت</span>
            <span className="type-price" aria-busy={coupon.busy}>
              {formatPrice(payable)}
            </span>
          </div>
        )}
        {hasUnavailable && (
          <p className="text-sm text-danger">
            برای ادامه، کالاهای با موجودی ناکافی را از سبد حذف یا تعدادشان را اصلاح کنید.
          </p>
        )}
        <Link href="/checkout">
          <Button fullWidth size="lg" disabled={hasUnavailable}>
            ادامه فرآیند خرید
          </Button>
        </Link>
      </Card>
    </div>
  );
}
