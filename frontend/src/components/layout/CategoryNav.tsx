import type { CategoryNode } from "@vista/shared";
import Link from "next/link";

/**
 * ناوبری دسته‌بندی‌ها — عمداً بدون JavaScript سمت Client. عنصر بومی <details>/<summary>
 * به‌صورت پیش‌فرض با کیبورد و Screen Reader کار می‌کند (Disclosure Pattern)، پس نیازی به
 * useState/onClick برای باز/بسته شدن نیست؛ فقط با CSS موقعیت Flyout در Desktop تنظیم می‌شود.
 */
export function CategoryNav({ tree }: { tree: CategoryNode[] }) {
  if (tree.length === 0) return null;

  return (
    <nav aria-label="دسته‌بندی محصولات">
      <ul className="flex flex-wrap gap-1 sm:gap-2">
        {tree.map((category) =>
          category.children.length > 0 ? (
            <li key={category.id} className="group relative">
              <details className="[&_summary::-webkit-details-marker]:hidden">
                <summary className="type-button flex cursor-pointer list-none items-center gap-1 rounded px-3 py-2 hover:bg-ivory-soft">
                  {category.name}
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="m5 8 5 5 5-5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </summary>
                <div className="static z-30 mt-1 w-full border-t border-border bg-ivory py-2 sm:absolute sm:mt-2 sm:w-56 sm:rounded sm:border sm:shadow-overlay">
                  <Link
                    href={`/categories/${category.slug}`}
                    className="block px-4 py-2 text-sm font-medium text-bordeaux hover:bg-ivory-soft"
                  >
                    مشاهده همه {category.name}
                  </Link>
                  {category.children.map((child) => (
                    <Link
                      key={child.id}
                      href={`/categories/${child.slug}`}
                      className="block px-4 py-2 text-sm text-ink hover:bg-ivory-soft"
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>
              </details>
            </li>
          ) : (
            <li key={category.id}>
              <Link
                href={`/categories/${category.slug}`}
                className="type-button block rounded px-3 py-2 hover:bg-ivory-soft"
              >
                {category.name}
              </Link>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}
