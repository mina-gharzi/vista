"use client";

import type { CartItemSummary, CartSummary } from "@vista/shared";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Spinner } from "@/components/ui";
import { cartApi } from "@/lib/api/cart";
import { ApiRequestError } from "@/lib/api/client";
import { formatPrice } from "@/lib/utils/format";

interface CartItemRowProps {
  item: CartItemSummary;
  onChange: (cart: CartSummary) => void;
}

export function CartItemRow({ item, onChange }: CartItemRowProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runUpdate = async (action: () => Promise<CartSummary>) => {
    setPending(true);
    setError(null);
    try {
      const cart = await action();
      onChange(cart);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "خطایی رخ داد");
    } finally {
      setPending(false);
    }
  };

  const changeQuantity = (delta: number) => {
    const next = item.quantity + delta;
    if (next < 1) return;
    void runUpdate(() => cartApi.updateItem(item.variantId, { quantity: next }));
  };

  const remove = () => {
    void runUpdate(() => cartApi.removeItem(item.variantId));
  };

  return (
    <div className="flex flex-col gap-2 border-b border-border py-4 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded bg-ivory-soft">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- تصاویر از دامنه‌های متنوع فروشندگان می‌آیند
          <img src={item.imageUrl} alt={item.productTitle} className="h-full w-full object-cover" />
        ) : null}
      </div>

      <div className="flex-1">
        <Link href={`/products/${item.productSlug}`} className="type-label hover:text-bordeaux">
          {item.productTitle}
        </Link>
        <p className="type-caption">
          {item.size} / {item.color}
        </p>
        {!item.isAvailable && (
          <Badge variant="danger" className="mt-1">
            موجودی کافی نیست (حداکثر {item.availableStock} عدد)
          </Badge>
        )}
        {error && <p className="mt-1 text-sm text-danger">{error}</p>}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          aria-label="کاهش تعداد"
          onClick={() => changeQuantity(-1)}
          disabled={pending || item.quantity <= 1}
        >
          −
        </Button>
        <span className="w-6 text-center tabular-nums" aria-live="polite">
          {pending ? <Spinner size="sm" /> : item.quantity}
        </span>
        <Button
          variant="secondary"
          size="sm"
          aria-label="افزایش تعداد"
          onClick={() => changeQuantity(1)}
          disabled={pending || item.quantity >= item.availableStock}
        >
          +
        </Button>
      </div>

      <div className="w-28 text-end type-price">{formatPrice(item.lineTotal)}</div>

      <Button variant="ghost" size="sm" onClick={remove} disabled={pending}>
        حذف
      </Button>
    </div>
  );
}
