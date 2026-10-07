import Link from "next/link";
import { buttonClasses, type ButtonVariant } from "@/components/ui";
import type { SellerNavItem } from "./sellerNav";

/**
 * دکمه‌ای که به یک بخش ناوبری اشاره می‌کند. اگر بخش هنوز ساخته نشده باشد، دکمه غیرفعال با
 * توضیح «به‌زودی» است (نه لینک به صفحه ناموجود و نه عملکرد ساختگی).
 */
export function NavCta({
  item,
  label,
  variant = "secondary",
}: {
  item: SellerNavItem;
  label: string;
  variant?: ButtonVariant;
}) {
  if (!item.available) {
    return (
      <span
        role="link"
        aria-disabled="true"
        className={buttonClasses({ variant, fullWidth: true })}
      >
        {label}
        <span className="text-xs">(به‌زودی)</span>
      </span>
    );
  }
  return (
    <Link href={item.href} className={buttonClasses({ variant, fullWidth: true })}>
      {label}
    </Link>
  );
}
