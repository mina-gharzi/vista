import { Card } from "@/components/ui";
import { NavCta } from "./NavCta";
import { findNavItem } from "./sellerNav";

export function QuickActions() {
  return (
    <Card as="section" aria-labelledby="quick-actions-title" className="flex flex-col gap-3">
      <h2 id="quick-actions-title" className="type-h3">
        اقدام سریع
      </h2>
      <NavCta
        item={{ ...findNavItem("products"), href: "/seller/products/new" }}
        label="افزودن محصول"
        variant="primary"
      />
      <NavCta item={findNavItem("orders")} label="مشاهده سفارش‌ها" />
      <NavCta item={findNavItem("inventory")} label="مدیریت موجودی" />
    </Card>
  );
}
