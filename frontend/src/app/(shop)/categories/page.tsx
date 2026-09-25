import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState } from "@/components/ui";
import { categoriesApi } from "@/lib/api/categories";

export const metadata: Metadata = { title: "دسته‌بندی‌ها" };
export const dynamic = "force-dynamic"; // فهرست دسته‌ها ممکن است تغییر کند؛ همیشه تازه واکشی شود

export default async function CategoriesPage() {
  const tree = await categoriesApi.getTree();

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="type-h1 mb-8">دسته‌بندی‌ها</h1>

      {tree.length === 0 ? (
        <EmptyState
          title="هنوز دسته‌بندی‌ای ثبت نشده"
          description="به‌زودی دسته‌های محصولات اینجا نمایش داده می‌شود."
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tree.map((category) => (
            <Card key={category.id} padding="lg" className="flex flex-col gap-3">
              <Link href={`/categories/${category.slug}`} className="type-h3 hover:text-bordeaux">
                {category.name}
              </Link>
              {category.children.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {category.children.map((child) => (
                    <li key={child.id}>
                      <Link
                        href={`/categories/${child.slug}`}
                        className="text-sm text-ink-muted hover:text-bordeaux"
                      >
                        {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
