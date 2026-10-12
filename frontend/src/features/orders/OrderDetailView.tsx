"use client";

import type { OrderDetail } from "@vista/shared";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, ErrorState, Skeleton } from "@/components/ui";
import { ApiRequestError } from "@/lib/api/client";
import { ordersApi } from "@/lib/api/orders";
import { formatDateTime, formatNumber, formatPrice } from "@/lib/utils/format";
import { CancelOrderDialog } from "./CancelOrderDialog";
import {
  fulfillmentStateBadge,
  fulfillmentStateLabel,
  fulfillmentStatusBadge,
  fulfillmentStatusLabel,
  orderStatusBadge,
  orderStatusLabel,
} from "./statusLabels";

type LoadState = "loading" | "error" | "notFound" | "unauthorized" | "ready";

interface Props {
  orderId: string;
  /** بعد از ثبت موفق Checkout (?placed=1) پیام موفقیت نشان داده می‌شود */
  justPlaced?: boolean;
}

export function OrderDetailView({ orderId, justPlaced = false }: Props) {
  const [state, setState] = useState<LoadState>("loading");
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    ordersApi
      .getById(orderId)
      .then((data) => {
        if (cancelled) return;
        setOrder(data);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiRequestError && error.status === 401) setState("unauthorized");
        else if (error instanceof ApiRequestError && error.status === 404) setState("notFound");
        else setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, reloadToken]);

  if (state === "loading") {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (state === "unauthorized") {
    return (
      <ErrorState
        title="نشست شما منقضی شده است"
        description="برای مشاهدهٔ سفارش دوباره وارد شوید."
        action={
          <Link href={`/login?next=/orders/${orderId}`} className="text-bordeaux underline">
            ورود به حساب کاربری
          </Link>
        }
      />
    );
  }

  if (state === "notFound") {
    return (
      <ErrorState title="سفارش پیدا نشد" description="ممکن است این سفارش متعلق به شما نباشد." />
    );
  }

  if (state === "error" || !order) {
    return <ErrorState onRetry={reload} />;
  }

  const showFulfillment = order.status !== "CANCELLED" && order.status !== "PENDING";

  return (
    <div className="flex flex-col gap-6">
      {justPlaced && order.status !== "CANCELLED" && (
        <p role="status" className="rounded border border-success bg-success-tint p-3 text-sm text-success">
          سفارش شما ثبت شد.
          {order.status === "PENDING" && " پرداخت آن هنوز تأیید نشده است."}
        </p>
      )}

      <Card padding="lg" className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="type-h3">سفارش #{formatNumber(order.orderNumber)}</h1>
          <p className="type-caption">{formatDateTime(order.createdAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={orderStatusBadge[order.status]}>
            <span className="sr-only">وضعیت پرداخت: </span>
            {orderStatusLabel[order.status]}
          </Badge>
          {showFulfillment && (
            <Badge variant={fulfillmentStateBadge[order.fulfillment.state]}>
              <span className="sr-only">وضعیت ارسال: </span>
              {fulfillmentStateLabel[order.fulfillment.state]}
            </Badge>
          )}
          {order.canCancel && (
            <Button type="button" variant="secondary" size="sm" onClick={() => setCancelOpen(true)}>
              لغو سفارش
            </Button>
          )}
        </div>
      </Card>

      {order.status === "PENDING" && (
        <p role="note" className="rounded border border-warning bg-warning-tint p-3 text-sm">
          این سفارش در انتظار پرداخت است. فروشنده‌ها تا تأیید پرداخت، کار روی سفارش را شروع نمی‌کنند.
        </p>
      )}

      {showFulfillment && order.fulfillment.totalParcels > 1 && (
        <p className="type-caption">
          {formatNumber(order.fulfillment.shippedParcels)} از{" "}
          {formatNumber(order.fulfillment.totalParcels)} بسته ارسال شده است.
        </p>
      )}

      {order.sellerOrders.map((sellerOrder) => (
        <Card key={sellerOrder.id} padding="lg" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="type-label">{sellerOrder.sellerStoreName}</p>
            <Badge variant={fulfillmentStatusBadge[sellerOrder.status]}>
              {fulfillmentStatusLabel[sellerOrder.status]}
            </Badge>
          </div>
          {sellerOrder.trackingCode && (
            <p className="text-sm">
              کد رهگیری:{" "}
              <span dir="ltr" className="font-medium">
                {sellerOrder.trackingCode}
              </span>
              {sellerOrder.shippedAt && (
                <span className="type-caption"> — ارسال: {formatDateTime(sellerOrder.shippedAt)}</span>
              )}
            </p>
          )}
          <div className="flex flex-col gap-3">
            {sellerOrder.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-ivory-soft">
                  {item.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- تصاویر از دامنه‌های متنوع فروشندگان می‌آیند
                    <img src={item.imageUrl} alt={item.productTitle} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex-1">
                  <Link href={`/products/${item.productSlug}`} className="text-sm font-medium hover:text-bordeaux">
                    {item.productTitle}
                  </Link>
                  <p className="type-caption">
                    {item.size} / {item.color} × {formatNumber(item.quantity)}
                    {" · "}
                    {formatPrice(item.unitPrice)}
                  </p>
                </div>
                <span className="type-price">{formatPrice(item.lineTotal)}</span>
              </div>
            ))}
          </div>
        </Card>
      ))}

      <Card padding="lg" className="flex flex-col gap-3">
        <h2 className="type-label">آدرس تحویل</h2>
        <p className="text-sm text-ink-muted">
          {order.shippingAddress.fullName} — {order.shippingAddress.province}،{" "}
          {order.shippingAddress.city}، {order.shippingAddress.addressLine}
        </p>
        <p dir="ltr" className="text-sm text-ink-muted">
          {order.shippingAddress.phone}
        </p>
      </Card>

      <Card padding="lg" className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm text-ink-muted">
          <span>جمع کالاها</span>
          <span>{formatPrice(order.subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-ink-muted">
          <span>هزینه ارسال</span>
          <span>{order.shippingCost === 0 ? "رایگان" : formatPrice(order.shippingCost)}</span>
        </div>
        {order.discountAmount > 0 && (
          <div className="flex items-center justify-between text-sm text-success">
            <span>تخفیف</span>
            <span>−{formatPrice(order.discountAmount)}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="type-label">مبلغ نهایی</span>
          <span className="type-price">{formatPrice(order.totalAmount)}</span>
        </div>
        {order.paidAt && <p className="type-caption">پرداخت: {formatDateTime(order.paidAt)}</p>}
        {order.cancelledAt && <p className="type-caption">لغو: {formatDateTime(order.cancelledAt)}</p>}
      </Card>

      {cancelOpen && (
        <CancelOrderDialog
          order={order}
          onClose={() => setCancelOpen(false)}
          onCancelled={(updated) => setOrder(updated)}
          onStale={reload}
        />
      )}
    </div>
  );
}
