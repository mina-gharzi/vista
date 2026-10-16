"use client";

import type { AdminOrderDetail } from "@vista/shared";
import Link from "next/link";
import { Badge, buttonClasses, Card } from "@/components/ui";
import {
  fulfillmentStateBadge,
  fulfillmentStateLabel,
  fulfillmentStatusBadge,
  fulfillmentStatusLabel,
  orderStatusBadge,
  orderStatusLabel,
} from "@/features/orders/statusLabels";
import { adminApi } from "@/lib/api/admin";
import { formatDateTime, formatNumber, formatPrice } from "@/lib/utils/format";
import { Field, QueryBoundary } from "./AdminParts";
import { useAdminQuery } from "./useAdminQuery";

function Body({ order }: { order: AdminOrderDetail }) {
  const a = order.shippingAddress;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="type-h1 tabular-nums">سفارش {formatNumber(order.orderNumber)}</h1>
          <Badge variant={orderStatusBadge[order.status]}>پرداخت: {orderStatusLabel[order.status]}</Badge>
          {order.status !== "CANCELLED" && (
            <Badge variant={fulfillmentStateBadge[order.fulfillment.state]}>ارسال: {fulfillmentStateLabel[order.fulfillment.state]}</Badge>
          )}
        </div>
        <Link href="/admin/orders" className={buttonClasses({ variant: "ghost", size: "sm" })}>
          بازگشت به سفارش‌ها
        </Link>
      </header>

      <Card as="section" aria-labelledby="o-info" className="flex flex-col gap-4">
        <h2 id="o-info" className="type-h3">
          اطلاعات سفارش
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="تاریخ ثبت" value={formatDateTime(order.createdAt)} />
          <Field label="تاریخ پرداخت" value={order.paidAt ? formatDateTime(order.paidAt) : "—"} />
          {order.cancelledAt && <Field label="تاریخ لغو" value={formatDateTime(order.cancelledAt)} />}
          <Field label="جمع اقلام" value={formatPrice(order.subtotal)} />
          <Field label="هزینه ارسال" value={formatPrice(order.shippingCost)} />
          <Field label="تخفیف" value={formatPrice(order.discountAmount)} />
          <Field label="مبلغ کل" value={formatPrice(order.totalAmount)} />
        </dl>
      </Card>

      <Card as="section" aria-labelledby="o-customer" className="flex flex-col gap-4">
        <h2 id="o-customer" className="type-h3">
          مشتری و آدرس ارسال (برای پشتیبانی)
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="مشتری" value={order.customer.name} />
          <Field label="ایمیل" value={<span dir="ltr">{order.customer.email}</span>} />
          <Field label="تلفن مشتری" value={order.customer.phone ? <span dir="ltr">{order.customer.phone}</span> : "—"} />
          <Field label="گیرنده" value={`${a.fullName} — ${a.phone}`} />
          <Field label="آدرس" value={`${a.province}، ${a.city}، ${a.addressLine} (کدپستی ${a.postalCode})`} />
        </dl>
      </Card>

      {order.sellerOrders.map((so) => (
        <Card as="section" key={so.id} aria-label={`بستهٔ ${so.sellerName}`} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="type-h3">
              <Link href={`/admin/sellers/${so.sellerId}`} className="hover:text-bordeaux">
                {so.sellerName}
              </Link>
            </h2>
            <Badge variant={fulfillmentStatusBadge[so.status]}>{fulfillmentStatusLabel[so.status]}</Badge>
          </div>
          {so.trackingCode && (
            <p className="text-sm">
              کد رهگیری: <span dir="ltr">{so.trackingCode}</span>
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {so.items.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  {i.productTitle} · {i.size}/{i.color} · <span dir="ltr">{i.sku}</span>
                </span>
                <span className="tabular-nums">
                  {formatNumber(i.quantity)} × {formatPrice(i.unitPrice)} = {formatPrice(i.lineTotal)}
                </span>
              </li>
            ))}
          </ul>
          {so.history.length > 0 && (
            <ol aria-label="تاریخچهٔ ارسال" className="flex flex-col gap-1 text-xs text-ink-muted">
              {so.history.map((h) => (
                <li key={h.id}>
                  {fulfillmentStatusLabel[h.fromStatus]} ← {fulfillmentStatusLabel[h.toStatus]} · {formatDateTime(h.createdAt)}
                </li>
              ))}
            </ol>
          )}
        </Card>
      ))}
    </div>
  );
}

export function AdminOrderDetailView({ orderId }: { orderId: string }) {
  const { state, reload } = useAdminQuery(() => adminApi.order(orderId), orderId);
  return (
    <QueryBoundary state={state} reload={reload} label="جزئیات سفارش" notFoundTitle="سفارش یافت نشد">
      {(order) => <Body order={order} />}
    </QueryBoundary>
  );
}
