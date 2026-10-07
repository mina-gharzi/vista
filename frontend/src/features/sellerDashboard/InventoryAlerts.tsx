import type { SellerDashboard, SellerDashboardStockAlert } from "@vista/shared";
import { Badge, Card } from "@/components/ui";
import { formatNumber } from "@/lib/utils/format";
import { findNavItem } from "./sellerNav";
import { NavCta } from "./NavCta";

function AlertList({
  title,
  items,
  total,
  describe,
  badge,
}: {
  title: string;
  items: SellerDashboardStockAlert[];
  total: number;
  describe: (item: SellerDashboardStockAlert) => string;
  badge: "warning" | "danger";
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        {title}
        <Badge variant={badge}>{formatNumber(total)}</Badge>
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">موردی وجود ندارد.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.variantId} className="rounded border border-border bg-ivory p-3 text-sm">
              <p className="font-medium">{item.productTitle}</p>
              <p className="text-ink-muted">
                {item.color} / {item.size}
              </p>
              <p className="tabular-nums">{describe(item)}</p>
            </li>
          ))}
        </ul>
      )}
      {total > items.length && (
        <p className="type-caption">و {formatNumber(total - items.length)} مورد دیگر</p>
      )}
    </div>
  );
}

export function InventoryAlerts({ data }: { data: SellerDashboard }) {
  const { summary, inventoryAlerts } = data;
  return (
    <Card as="section" aria-labelledby="inventory-alerts-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 id="inventory-alerts-title" className="type-h3">
          هشدار موجودی
        </h2>
        <p className="type-caption">
          موجودی کمتر یا مساوی {formatNumber(inventoryAlerts.lowStockThreshold)} عدد «رو به اتمام»
          حساب می‌شود.
        </p>
      </div>
      <AlertList
        title="محصولات رو به اتمام"
        items={inventoryAlerts.lowStock}
        total={summary.lowStockCount}
        badge="warning"
        describe={(item) => `${formatNumber(item.stock)} عدد باقی مانده`}
      />
      <AlertList
        title="محصولات ناموجود"
        items={inventoryAlerts.outOfStock}
        total={summary.outOfStockCount}
        badge="danger"
        describe={() => "ناموجود"}
      />
      <NavCta item={findNavItem("inventory")} label="مشاهده موجودی" variant="secondary" />
    </Card>
  );
}
