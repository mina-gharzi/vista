"use client";

import Link from "next/link";
import { buttonClasses, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { fulfillmentStatusLabel } from "@/features/orders/statusLabels";
import { formatNumber, formatPrice } from "@/lib/utils/format";
import { InventoryAlerts } from "./InventoryAlerts";
import { MetricCard } from "./MetricCard";
import { QuickActions } from "./QuickActions";
import { RecentOrders } from "./RecentOrders";
import { StoreInfo } from "./StoreInfo";
import { useSellerDashboard } from "./useSellerDashboard";

const ORDER_STATUSES_SHOWN = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

function DashboardSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <Skeleton className="h-9 w-2/3 max-w-sm" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function SellerDashboardView() {
  const { state, reload } = useSellerDashboard();

  if (state.status === "loading") return <DashboardSkeleton />;

  if (state.status === "error") {
    return <ErrorState description="دریافت اطلاعات داشبورد انجام نشد." onRetry={reload} />;
  }

  if (state.status === "forbidden") {
    return (
      <EmptyState
        title="به پنل فروشنده دسترسی ندارید"
        description={state.message}
        action={
          <Link href="/seller/application" className={buttonClasses({ variant: "primary" })}>
            وضعیت درخواست فروشندگی
          </Link>
        }
      />
    );
  }

  const { data } = state;
  const { summary } = data;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="type-h1">خوش آمدید، {data.seller.storeName}</h1>
        <p className="text-ink-muted">نمای کلی فروشگاه شما در ویستا.</p>
      </header>

      <section aria-label="خلاصه وضعیت فروشگاه" className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="فروش کل" value={formatPrice(summary.totalSales)} highlight />
          <MetricCard
            label="سفارش‌ها"
            value={formatNumber(summary.totalOrders)}
            caption={`${formatNumber(summary.pendingOrders)} سفارش در انتظار ارسال`}
          />
          <MetricCard
            label="محصولات"
            value={formatNumber(summary.productCount)}
            caption={`${formatNumber(summary.publishedProductCount)} محصول منتشرشده`}
          />
          <MetricCard
            label="موجودی کم"
            value={formatNumber(summary.lowStockCount)}
            caption={`${formatNumber(summary.outOfStockCount)} مورد ناموجود`}
          />
        </div>

        <Card as="div" className="flex flex-col gap-2">
          <h2 className="type-label">وضعیت سفارش‌ها</h2>
          <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {ORDER_STATUSES_SHOWN.map((status) => (
              <li key={status} className="flex items-center justify-between rounded bg-ivory px-3 py-2">
                <span className="text-ink-muted">{fulfillmentStatusLabel[status]}</span>
                <span className="font-medium tabular-nums">
                  {formatNumber(summary.ordersByStatus[status])}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <RecentOrders orders={data.recentOrders} />
          <InventoryAlerts data={data} />
        </div>
        <div className="flex flex-col gap-6">
          <QuickActions />
          <StoreInfo seller={data.seller} />
        </div>
      </div>
    </div>
  );
}
