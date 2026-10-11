"use client";

import type { SellerFulfillmentTarget, SellerOrderDetail } from "@vista/shared";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, buttonClasses, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { fulfillmentStatusBadge, fulfillmentStatusLabel } from "@/features/orders/statusLabels";
import { formatDateTime, formatNumber, formatPrice } from "@/lib/utils/format";
import { StatusChangeDialog, TRANSITION_ACTION_LABEL } from "./StatusChangeDialog";
import { useSellerOrderDetail } from "./useSellerOrders";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

function OrderBody({ order, onAction }: { order: SellerOrderDetail; onAction: (t: SellerFulfillmentTarget) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="type-h1 tabular-nums">سفارش {formatNumber(order.orderNumber)}</h1>
          <Badge variant={fulfillmentStatusBadge[order.status]}>{fulfillmentStatusLabel[order.status]}</Badge>
        </div>
        <Link href="/seller/orders" className={buttonClasses({ variant: "ghost", size: "sm" })}>
          بازگشت به سفارش‌ها
        </Link>
      </header>

      {order.allowedTransitions.length > 0 && (
        <Card as="section" aria-label="اقدام بعدی" className="flex flex-wrap items-center gap-3">
          {order.allowedTransitions.map((target) => (
            <Button
              key={target}
              variant={target === "SHIPPED" ? "primary" : "secondary"}
              onClick={() => onAction(target)}
            >
              {TRANSITION_ACTION_LABEL[target]}
            </Button>
          ))}
        </Card>
      )}

      <Card as="section" aria-labelledby="order-info-title" className="flex flex-col gap-4">
        <h2 id="order-info-title" className="type-h3">
          اطلاعات سفارش
        </h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="تاریخ ثبت" value={formatDateTime(order.createdAt)} />
          <Field label="تاریخ پرداخت" value={order.paidAt ? formatDateTime(order.paidAt) : "—"} />
          <Field label="تاریخ ارسال" value={order.shippedAt ? formatDateTime(order.shippedAt) : "—"} />
          <Field label="تاریخ تحویل" value={order.deliveredAt ? formatDateTime(order.deliveredAt) : "—"} />
          <Field label="کد رهگیری" value={order.trackingCode ?? "—"} />
        </dl>
      </Card>

      <Card as="section" aria-labelledby="order-items-title" className="flex flex-col gap-4">
        <h2 id="order-items-title" className="type-h3">
          اقلام شما
        </h2>
        <ul aria-label="اقلام سفارش" className="flex flex-col gap-3">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 rounded border border-border bg-ivory p-3">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt={item.productTitle} className="h-16 w-16 shrink-0 rounded object-cover" />
              ) : (
                <div aria-hidden="true" className="h-16 w-16 shrink-0 rounded bg-ivory-soft" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="font-medium">{item.productTitle}</p>
                <p className="text-sm text-ink-muted">
                  {item.color} / {item.size}
                </p>
                <p className="text-xs text-ink-muted" dir="ltr" style={{ textAlign: "start" }}>
                  SKU: {item.sku}
                </p>
              </div>
              <div className="flex flex-col items-end gap-0.5 text-sm tabular-nums">
                <p>
                  {formatNumber(item.quantity)} × {formatPrice(item.unitPrice)}
                </p>
                <p className="font-medium">{formatPrice(item.lineTotal)}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="flex items-center justify-between border-t border-border pt-3 font-medium tabular-nums">
          <span>جمع اقلام شما</span>
          <span>{formatPrice(order.subtotal)}</span>
        </p>
      </Card>

      {order.shipping && (
        <Card as="section" aria-labelledby="order-shipping-title" className="flex flex-col gap-4">
          <h2 id="order-shipping-title" className="type-h3">
            اطلاعات ارسال
          </h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="گیرنده" value={order.shipping.fullName} />
            <Field label="تلفن" value={order.shipping.phone} />
            <Field label="استان و شهر" value={`${order.shipping.province}، ${order.shipping.city}`} />
            <Field label="کد پستی" value={order.shipping.postalCode} />
            <div className="sm:col-span-2">
              <Field label="نشانی" value={order.shipping.addressLine} />
            </div>
          </dl>
        </Card>
      )}

      <Card as="section" aria-labelledby="order-history-title" className="flex flex-col gap-3">
        <h2 id="order-history-title" className="type-h3">
          تاریخچه وضعیت
        </h2>
        {order.history.length === 0 ? (
          <p className="text-sm text-ink-muted">هنوز تغییری ثبت نشده است.</p>
        ) : (
          <ol aria-label="تاریخچه تغییر وضعیت" className="flex flex-col gap-2">
            {order.history.map((event) => (
              <li key={event.id} className="rounded border border-border bg-ivory p-3 text-sm">
                <p>
                  {fulfillmentStatusLabel[event.fromStatus]} ← <strong>{fulfillmentStatusLabel[event.toStatus]}</strong>
                </p>
                {event.trackingCode && (
                  <p className="text-ink-muted" dir="ltr" style={{ textAlign: "start" }}>
                    {event.trackingCode}
                  </p>
                )}
                <time dateTime={event.createdAt} className="text-ink-muted">
                  {formatDateTime(event.createdAt)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

export function SellerOrderDetailView({ sellerOrderId }: { sellerOrderId: string }) {
  const { state, reload, setOrder } = useSellerOrderDetail(sellerOrderId);
  const [target, setTarget] = useState<SellerFulfillmentTarget | null>(null);

  if (state.status === "loading") {
    return (
      <div aria-busy="true" aria-label="در حال بارگذاری سفارش" className="flex flex-col gap-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (state.status === "error") {
    return <ErrorState description="دریافت سفارش انجام نشد." onRetry={reload} />;
  }
  const backLink = (
    <Link href="/seller/orders" className={buttonClasses({ variant: "primary" })}>
      بازگشت به سفارش‌ها
    </Link>
  );
  if (state.status === "notFound") {
    return <EmptyState title="سفارش یافت نشد" description="این سفارش وجود ندارد یا متعلق به شما نیست." action={backLink} />;
  }
  if (state.status === "forbidden") {
    return <EmptyState title="دسترسی به این سفارش ندارید" description={state.message} action={backLink} />;
  }

  return (
    <>
      <OrderBody order={state.order} onAction={setTarget} />
      {target && (
        <StatusChangeDialog
          order={state.order}
          target={target}
          onClose={() => setTarget(null)}
          onUpdated={setOrder}
          onStale={reload}
        />
      )}
    </>
  );
}
