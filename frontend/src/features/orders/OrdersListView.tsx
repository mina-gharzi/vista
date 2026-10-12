"use client";

import type { OrderListItem, OrderStatus } from "@vista/shared";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, Pagination, Skeleton } from "@/components/ui";
import { ApiRequestError } from "@/lib/api/client";
import { ordersApi } from "@/lib/api/orders";
import { cn } from "@/lib/utils/cn";
import { formatDate, formatNumber, formatPrice } from "@/lib/utils/format";
import {
  fulfillmentStateBadge,
  fulfillmentStateLabel,
  orderStatusBadge,
  orderStatusLabel,
} from "./statusLabels";

type LoadState = "loading" | "error" | "unauthorized" | "ready";
type Filter = "ALL" | OrderStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "همه" },
  { value: "PENDING", label: "در انتظار پرداخت" },
  { value: "PAID", label: "پرداخت‌شده" },
  { value: "CANCELLED", label: "لغوشده" },
];

export function OrdersListView() {
  const [state, setState] = useState<LoadState>("loading");
  const [items, setItems] = useState<OrderListItem[]>([]);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [totalPages, setTotalPages] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);

  const retry = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    ordersApi
      .list(page, filter === "ALL" ? undefined : filter)
      .then((result) => {
        if (cancelled) return;
        setItems(result.data);
        setTotalPages(result.pagination.totalPages);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState(error instanceof ApiRequestError && error.status === 401 ? "unauthorized" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [page, filter, reloadToken]);

  const changeFilter = (value: Filter) => {
    setFilter(value);
    setPage(1);
  };

  const filters = (
    <div role="group" aria-label="فیلتر وضعیت پرداخت" className="mb-4 flex flex-wrap gap-2">
      {FILTERS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={filter === option.value}
          onClick={() => changeFilter(option.value)}
          className={cn(
            "rounded-full border px-3 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-bordeaux",
            filter === option.value
              ? "border-bordeaux bg-bordeaux text-ivory"
              : "border-border text-ink hover:border-bordeaux",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  if (state === "unauthorized") {
    return (
      <ErrorState
        title="نشست شما منقضی شده است"
        description="برای مشاهدهٔ سفارش‌ها دوباره وارد شوید."
        action={
          <Link href="/login?next=/orders" className="text-bordeaux underline">
            ورود به حساب کاربری
          </Link>
        }
      />
    );
  }

  return (
    <div>
      {filters}
      {state === "loading" && (
        <div aria-busy="true" className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {state === "error" && <ErrorState onRetry={retry} />}

      {state === "ready" && items.length === 0 && (
        <EmptyState
          title={filter === "ALL" ? "هنوز سفارشی ثبت نکرده‌اید" : "سفارشی با این وضعیت پیدا نشد"}
          action={
            filter === "ALL" ? (
              <Link href="/products">
                <Button>مشاهده محصولات</Button>
              </Link>
            ) : (
              <Button variant="secondary" onClick={() => changeFilter("ALL")}>
                نمایش همهٔ سفارش‌ها
              </Button>
            )
          }
        />
      )}

      {state === "ready" && items.length > 0 && (
        <div className="flex flex-col gap-4">
          {items.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`}>
              <Card padding="lg" className="flex items-center justify-between gap-4 hover:shadow-overlay">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-ivory-soft">
                    {order.previewImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- تصاویر از دامنه‌های متنوع فروشندگان می‌آیند
                      <img src={order.previewImageUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div>
                    <p className="type-label">سفارش #{formatNumber(order.orderNumber)}</p>
                    <p className="type-caption">
                      {formatNumber(order.itemCount)} کالا · {formatDate(order.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex flex-wrap justify-end gap-1">
                    <Badge variant={orderStatusBadge[order.status]}>{orderStatusLabel[order.status]}</Badge>
                    {order.status !== "CANCELLED" && (
                      <Badge variant={fulfillmentStateBadge[order.fulfillment.state]}>
                        {fulfillmentStateLabel[order.fulfillment.state]}
                      </Badge>
                    )}
                  </div>
                  <span className="type-price">{formatPrice(order.totalAmount)}</span>
                </div>
              </Card>
            </Link>
          ))}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
        </div>
      )}
    </div>
  );
}
