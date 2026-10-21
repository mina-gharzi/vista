export interface AdminNavItem {
  key: string;
  label: string;
  href: string;
}

/** تنها منبع ناوبری ناحیه ادمین (دسکتاپ و موبایل). */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { key: "dashboard", label: "داشبورد", href: "/admin/dashboard" },
  { key: "sellers", label: "فروشندگان", href: "/admin/sellers" },
  { key: "products", label: "محصولات", href: "/admin/products" },
  { key: "categories", label: "دسته‌بندی‌ها", href: "/admin/categories" },
  { key: "orders", label: "سفارش‌ها", href: "/admin/orders" },
  { key: "coupons", label: "کوپن‌ها", href: "/admin/coupons" },
];
