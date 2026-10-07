import type { SellerDashboardRecentOrder } from "@vista/shared";
import { Badge, Card, EmptyState } from "@/components/ui";
import { fulfillmentStatusBadge, fulfillmentStatusLabel } from "@/features/orders/statusLabels";
import { formatDate, formatNumber, formatPrice } from "@/lib/utils/format";

const orderIcon = (
  <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M6 4h12v16l-3-2-3 2-3-2-3 2V4Zm3 5h6m-6 4h4"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);

/** جدول در md به بالا، کارت‌های عمودی در موبایل (بدون اسکرول افقی). */
export function RecentOrders({ orders }: { orders: SellerDashboardRecentOrder[] }) {
  return (
    <Card as="section" aria-labelledby="recent-orders-title" className="flex flex-col gap-4">
      <h2 id="recent-orders-title" className="type-h3">
        آخرین سفارش‌ها
      </h2>

      {orders.length === 0 ? (
        <EmptyState icon={orderIcon} title="هنوز سفارشی ثبت نشده است." className="py-8" />
      ) : (
        <>
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-border text-start text-ink-muted">
                <th scope="col" className="py-2 text-start font-medium">شماره سفارش</th>
                <th scope="col" className="py-2 text-start font-medium">تاریخ</th>
                <th scope="col" className="py-2 text-start font-medium">تعداد کالا</th>
                <th scope="col" className="py-2 text-start font-medium">مبلغ</th>
                <th scope="col" className="py-2 text-start font-medium">وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-border last:border-0">
                  <th scope="row" className="py-3 text-start font-medium tabular-nums">
                    {formatNumber(order.orderNumber)}
                  </th>
                  <td className="py-3">{formatDate(order.createdAt)}</td>
                  <td className="py-3 tabular-nums">{formatNumber(order.itemCount)}</td>
                  <td className="py-3 tabular-nums">{formatPrice(order.total)}</td>
                  <td className="py-3">
                    <Badge variant={fulfillmentStatusBadge[order.status]}>
                      {fulfillmentStatusLabel[order.status]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="flex flex-col gap-3 md:hidden">
            {orders.map((order) => (
              <li
                key={order.id}
                className="flex flex-col gap-2 rounded border border-border bg-ivory p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium tabular-nums">
                    سفارش {formatNumber(order.orderNumber)}
                  </span>
                  <Badge variant={fulfillmentStatusBadge[order.status]}>
                    {fulfillmentStatusLabel[order.status]}
                  </Badge>
                </div>
                <p className="text-sm text-ink-muted">
                  {formatDate(order.createdAt)} · {formatNumber(order.itemCount)} کالا
                </p>
                <p className="font-medium tabular-nums">{formatPrice(order.total)}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
