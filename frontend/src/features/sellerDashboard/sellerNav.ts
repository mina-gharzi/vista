export interface SellerNavItem {
  key: string;
  label: string;
  href: string;
  /**
   * false یعنی این بخش هنوز ساخته نشده: در منو غیرفعال و با برچسب «به‌زودی» نمایش داده می‌شود
   * (لینک به صفحه ناموجود، یا صفحه ساختگی، ساخته نمی‌شود). هنگام ساخت هر بخش فقط همین مقدار true می‌شود.
   */
  available: boolean;
}

/** تنها منبع ناوبری ناحیه فروشنده؛ منوی دسکتاپ، موبایل و دکمه‌های «اقدام سریع» از همین‌جا می‌آیند. */
export const SELLER_NAV: readonly SellerNavItem[] = [
  { key: "dashboard", label: "داشبورد", href: "/seller/dashboard", available: true },
  { key: "products", label: "محصولات", href: "/seller/products", available: false },
  { key: "orders", label: "سفارش‌ها", href: "/seller/orders", available: false },
  { key: "inventory", label: "موجودی", href: "/seller/inventory", available: false },
  { key: "settings", label: "تنظیمات", href: "/seller/settings", available: false },
];

export function findNavItem(key: string): SellerNavItem {
  const item = SELLER_NAV.find((entry) => entry.key === key);
  if (!item) throw new Error(`آیتم ناوبری ناشناخته: ${key}`);
  return item;
}
