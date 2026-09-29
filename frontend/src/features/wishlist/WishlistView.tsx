"use client";

import type { WishlistItemSummary } from "@vista/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton, useToast } from "@/components/ui";
import { ApiRequestError } from "@/lib/api/client";
import { wishlistApi } from "@/lib/api/wishlist";
import { formatPrice } from "@/lib/utils/format";

type LoadState = "loading" | "error" | "ready";

export function WishlistView() {
  const { toast } = useToast();
  const [state, setState] = useState<LoadState>("loading");
  const [items, setItems] = useState<WishlistItemSummary[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = () => {
    setState("loading");
    wishlistApi
      .list()
      .then((data) => {
        setItems(data);
        setState("ready");
      })
      .catch(() => setState("error"));
  };

  useEffect(load, []);

  const remove = async (productId: string) => {
    setRemovingId(productId);
    try {
      setItems(await wishlistApi.remove(productId));
    } catch (error) {
      toast({
        title: "حذف ناموفق بود",
        description: error instanceof ApiRequestError ? error.message : undefined,
        variant: "error",
      });
    } finally {
      setRemovingId(null);
    }
  };

  if (state === "loading") {
    return (
      <div aria-busy="true" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Skeleton className="aspect-[3/4] w-full" />
        <Skeleton className="aspect-[3/4] w-full" />
        <Skeleton className="aspect-[3/4] w-full" />
      </div>
    );
  }

  if (state === "error") {
    return <ErrorState onRetry={load} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="علاقه‌مندی‌های شما خالی است"
        description="با زدن آیکون قلب روی هر محصول، آن را اینجا ذخیره کنید."
        action={
          <Link href="/products">
            <Button>مشاهده محصولات</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => {
        const hasDiscount = item.compareAtPrice !== null && item.compareAtPrice > item.basePrice;
        return (
          <Card key={item.productId} padding="sm" className="flex flex-col gap-3">
            <Link
              href={`/products/${item.productSlug}`}
              className="relative block aspect-[3/4] overflow-hidden rounded bg-ivory"
            >
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- تصاویر از دامنه‌های متنوع فروشندگان می‌آیند
                <img
                  src={item.imageUrl}
                  alt={item.productTitle}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-ink-faint">
                  بدون تصویر
                </div>
              )}
              {!item.isAvailable && (
                <Badge variant="danger" className="absolute start-2 top-2">
                  در دسترس نیست
                </Badge>
              )}
            </Link>
            <div className="flex flex-col gap-1">
              <p className="type-caption">{item.categoryName}</p>
              <Link
                href={`/products/${item.productSlug}`}
                className="line-clamp-2 text-sm font-medium hover:text-bordeaux"
              >
                {item.productTitle}
              </Link>
              <div className="flex items-baseline gap-2">
                <span className="type-price">{formatPrice(item.basePrice)}</span>
                {hasDiscount && (
                  <span className="text-xs text-ink-faint line-through">
                    {formatPrice(item.compareAtPrice as number)}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void remove(item.productId)}
              loading={removingId === item.productId}
            >
              حذف از علاقه‌مندی‌ها
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
