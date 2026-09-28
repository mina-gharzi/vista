"use client";

import type { OrderListItem } from "@vista/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, Pagination, Skeleton } from "@/components/ui";
import { ordersApi } from "@/lib/api/orders";
import { formatPrice, formatNumber } from "@/lib/utils/format";
import { orderStatusBadge, orderStatusLabel } from "./statusLabels";

type LoadState = "loading" | "error" | "ready";

export function OrdersListView() {
  const [state, setState] = useState<LoadState>("loading");
  const [items, setItems] = useState<OrderListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setState("loading");
    ordersApi
      .list(page)
      .then((result) => {
        setItems(result.data);
        setTotalPages(result.pagination.totalPages);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [page]);

  if (state === "loading") {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (state === "error") {
    return <ErrorState onRetry={() => setPage((p) => p)} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="هنوز سفارشی ثبت نکرده‌اید"
        action={
          <Link href="/products">
            <Button>مشاهده محصولات</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((order) => (
        <Link key={order.id} href={`/orders/${order.id}`}>
          <Card
            padding="lg"
            className="flex items-center justify-between gap-4 hover:shadow-overlay"
          >
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-ivory-soft">
                {order.previewImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- تصاویر از دامنه‌های متنوع فروشندگان می‌آیند
                  <img src={order.previewImageUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div>
                <p className="type-label">سفارش #{formatNumber(order.orderNumber)}</p>
                <p className="type-caption">{order.itemCount} کالا</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant={orderStatusBadge[order.status]}>
                {orderStatusLabel[order.status]}
              </Badge>
              <span className="type-price">{formatPrice(order.totalAmount)}</span>
            </div>
          </Card>
        </Link>
      ))}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
    </div>
  );
}
