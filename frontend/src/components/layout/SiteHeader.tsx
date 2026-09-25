import Link from "next/link";
import { categoriesApi } from "@/lib/api/categories";
import { CategoryNav } from "./CategoryNav";
import { HeaderAuthArea } from "./HeaderAuthArea";

/**
 * Server Component: درخت دسته‌ها روی سرور واکشی می‌شود (بدون Loading State اضافه در Client).
 * اگر Backend موقتاً در دسترس نباشد، ناوبری خالی نمایش داده می‌شود نه اینکه کل سایت خراب شود.
 */
export async function SiteHeader() {
  const tree = await categoriesApi.getTree().catch(() => []);

  return (
    <header className="border-b border-border bg-ivory">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        <Link href="/" className="text-2xl font-semibold tracking-tight text-bordeaux">
          ویستا
        </Link>
        <CategoryNav tree={tree} />
        <HeaderAuthArea />
      </div>
    </header>
  );
}
