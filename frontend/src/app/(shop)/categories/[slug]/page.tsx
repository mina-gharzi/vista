import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, EmptyState } from "@/components/ui";
import { ApiRequestError } from "@/lib/api/client";
import { categoriesApi } from "@/lib/api/categories";

export const dynamic = "force-dynamic";

interface CategoryPageProps {
  params: { slug: string };
}

async function loadCategory(slug: string) {
  try {
    return await categoriesApi.getBySlug(slug);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const category = await loadCategory(params.slug);
  return { title: category?.name ?? "دسته‌بندی" };
}

export default async function CategoryDetailPage({ params }: CategoryPageProps) {
  const category = await loadCategory(params.slug);
  if (!category) notFound();

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <nav
        aria-label="مسیر دسته‌بندی"
        className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-ink-muted"
      >
        <Link href="/categories" className="hover:text-bordeaux">
          دسته‌بندی‌ها
        </Link>
        {category.breadcrumb.map((ancestor) => (
          <span key={ancestor.id} className="flex items-center gap-1.5">
            <span aria-hidden="true">/</span>
            <Link href={`/categories/${ancestor.slug}`} className="hover:text-bordeaux">
              {ancestor.name}
            </Link>
          </span>
        ))}
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="text-ink">
          {category.name}
        </span>
      </nav>

      <h1 className="type-h1 mb-8">{category.name}</h1>

      {category.children.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {category.children.map((child) => (
            <Card key={child.id} padding="lg">
              <Link href={`/categories/${child.slug}`} className="type-h3 hover:text-bordeaux">
                {child.name}
              </Link>
            </Card>
          ))}
        </div>
      ) : (
        // Product Catalog در Feature بعدی این بخش را با فهرست محصولات جایگزین می‌کند
        <EmptyState
          title="محصولی هنوز اضافه نشده"
          description="محصولات این دسته به‌زودی نمایش داده می‌شود."
        />
      )}
    </main>
  );
}
