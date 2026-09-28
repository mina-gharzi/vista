"use client";

import type { OrderDetail } from "@vista/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Card, ErrorState, Skeleton } from "@/components/ui";
import { ordersApi } from "@/lib/api/orders";
import { formatNumber, formatPrice } from "@/lib/utils/format";
import {
  fulfillmentStatusBadge,
  fulfillmentStatusLabel,
  orderStatusBadge,
  orderStatusLabel,
} from "./statusLabels";

type LoadState = "loading" | "error" | "ready";

export function OrderDetailView({ orderId }: { orderId: string }) {
  const [state, setState] = useState<LoadState>("loading");
  const [order, setOrder] = useState<OrderDetail | null>(null);

  useEffect(() => {
    ordersApi
      .getById(orderId)
      .then((data) => {
        setOrder(data);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [orderId]);

  if (state === "loading") {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (state === "error" || !order) {
    return (
      <ErrorState title="سفارش پیدا نشد" description="ممکن است این سفارش متعلق به شما نباشد." />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card padding="lg" className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="type-h3">سفارش #{formatNumber(order.orderNumber)}</p>
          <p className="type-caption">
            {new Date(order.createdAt).toLocaleDateString("fa-IR", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <Badge variant={orderStatusBadge[order.status]}>{orderStatusLabel[order.status]}</Badge>
      </Card>

      {order.sellerOrders.map((sellerOrder) => (
        <Card key={sellerOrder.id} padding="lg" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="type-label">{sellerOrder.sellerStoreName}</p>
            <Badge variant={fulfillmentStatusBadge[sellerOrder.status]}>
              {fulfillmentStatusLabel[sellerOrder.status]}
            </Badge>
          </div>
          <div className="flex flex-col gap-3">
            {sellerOrder.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-ivory-soft">
                  {item.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- تصاویر از دامنه‌های متنوع فروشندگان می‌آیند
                    <img
                      src={item.imageUrl}
                      alt={item.productTitle}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1">
                  <Link
                    href={`/products/${item.productSlug}`}
                    className="text-sm font-medium hover:text-bordeaux"
                  >
                    {item.productTitle}
                  </Link>
                  <p className="type-caption">
                    {item.size} / {item.color} × {formatNumber(item.quantity)}
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
      </Card>
    </div>
  );
}
