"use client";

import { PRODUCT_STATUS_LABEL, SELLER_STATUS_LABEL, type AdminDashboard } from "@vista/shared";
import Link from "next/link";
import { Badge, buttonClasses, Card } from "@/components/ui";
import { orderStatusBadge, orderStatusLabel } from "@/features/orders/statusLabels";
import { adminApi } from "@/lib/api/admin";
import { formatDate, formatNumber, formatPrice } from "@/lib/utils/format";
import { QueryBoundary } from "./AdminParts";
import { sellerStatusBadge } from "./adminLabels";
import { useAdminQuery } from "./useAdminQuery";

function Metric({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = (
    <>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="type-h2 tabular-nums">{formatNumber(value)}</p>
    </>
  );
  return (
    <Card padding="sm" className="flex flex-col gap-1">
      {href ? (
        <Link href={href} className="flex flex-col gap-1 hover:text-bordeaux">
          {body}
        </Link>
      ) : (
        body
      )}
    </Card>
  );
}

function Breakdown<K extends string>({
  title,
  counts,
  labels,
}: {
  title: string;
  counts: Record<K, number>;
  labels: Record<K, string>;
}) {
  return (
    <Card as="section" aria-label={title} className="flex flex-col gap-3">
      <h2 className="type-h3">{title}</h2>
      <ul className="flex flex-col gap-2">
        {(Object.keys(labels) as K[]).map((key) => (
          <li key={key} className="flex items-center justify-between text-sm">
            <span>{labels[key]}</span>
            <span className="tabular-nums">{formatNumber(counts[key] ?? 0)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Body({ data }: { data: AdminDashboard }) {
  return (
    <div className="flex flex-col gap-6">
      <section aria-label="شاخص‌های کلیدی" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="مشتریان" value={data.customers} />
        <Metric label="درخواست‌های در انتظار بررسی" value={data.pendingSellerApplications} href="/admin/sellers" />
        <Metric label="محصولات منتشرشده" value={data.products.PUBLISHED} href="/admin/products" />
        <Metric label="سفارش‌ها" value={Object.values(data.orders).reduce((a, b) => a + b, 0)} href="/admin/orders" />
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Breakdown title="فروشندگان بر اساس وضعیت" counts={data.sellers} labels={SELLER_STATUS_LABEL} />
        <Breakdown title="محصولات بر اساس وضعیت" counts={data.products} labels={PRODUCT_STATUS_LABEL} />
        <Breakdown title="سفارش‌ها بر اساس وضعیت پرداخت" counts={data.orders} labels={orderStatusLabel} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card as="section" aria-label="آخرین سفارش‌ها" className="flex flex-col gap-3">
          <h2 className="type-h3">آخرین سفارش‌ها</h2>
          {data.recentOrders.length === 0 ? (
            <p className="text-sm text-ink-muted">هنوز سفارشی ثبت نشده است.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.recentOrders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <Link href={`/admin/orders/${o.id}`} className="font-medium tabular-nums hover:text-bordeaux">
                    #{formatNumber(o.orderNumber)}
                  </Link>
                  <span className="tabular-nums">{formatPrice(o.totalAmount)}</span>
                  <Badge variant={orderStatusBadge[o.status]}>{orderStatusLabel[o.status]}</Badge>
                  <span className="text-ink-muted">{formatDate(o.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card as="section" aria-label="آخرین فروشندگان" className="flex flex-col gap-3">
          <h2 className="type-h3">آخرین فروشندگان</h2>
          {data.recentSellers.length === 0 ? (
            <p className="text-sm text-ink-muted">هنوز فروشنده‌ای ثبت‌نام نکرده است.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.recentSellers.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <Link href={`/admin/sellers/${s.id}`} className="font-medium hover:text-bordeaux">
                    {s.storeName}
                  </Link>
                  <Badge variant={sellerStatusBadge[s.status]}>{SELLER_STATUS_LABEL[s.status]}</Badge>
                  <span className="text-ink-muted">{formatDate(s.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
          {data.pendingSellerApplications > 0 && (
            <Link href="/admin/sellers?status=PENDING" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              بررسی درخواست‌های در انتظار
            </Link>
          )}
        </Card>
      </div>
      <p className="type-caption">
        شمارش‌ها مستقیم از دیتابیس هستند. معیار «درآمد» نمایش داده نمی‌شود چون تعریف تأییدشده‌ای برای آن (پس از پرداخت واقعی) وجود ندارد.
      </p>
    </div>
  );
}

export function AdminDashboardView() {
  const { state, reload } = useAdminQuery(() => adminApi.dashboard(), "dashboard");
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="type-h1">داشبورد مدیریت</h1>
      </header>
      <QueryBoundary state={state} reload={reload} label="داشبورد" skeletonRows={3}>
        {(data) => <Body data={data} />}
      </QueryBoundary>
    </div>
  );
}
