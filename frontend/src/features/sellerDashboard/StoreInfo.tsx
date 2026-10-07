import type { SellerDashboardSeller } from "@vista/shared";
import { Badge, Card } from "@/components/ui";

export function StoreInfo({ seller }: { seller: SellerDashboardSeller }) {
  return (
    <Card as="section" aria-labelledby="store-info-title" className="flex flex-col gap-3">
      <h2 id="store-info-title" className="type-h3">
        اطلاعات فروشگاه
      </h2>
      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="type-caption">نام فروشگاه</dt>
          <dd className="font-medium">{seller.storeName}</dd>
        </div>
        <div>
          <dt className="type-caption">شناسه فروشگاه</dt>
          <dd dir="ltr" className="text-start font-medium">
            {seller.slug}
          </dd>
        </div>
        <div>
          <dt className="type-caption">وضعیت</dt>
          <dd>
            <Badge variant="success">فعال / تأیید شده</Badge>
          </dd>
        </div>
      </dl>
    </Card>
  );
}
