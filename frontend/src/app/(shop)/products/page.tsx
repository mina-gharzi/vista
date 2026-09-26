import type { Metadata } from "next";
import type { ProductSortOption } from "@vista/shared";
import { Button, buttonClasses, Input, Pagination, Select } from "@/components/ui";
import { ProductGrid } from "@/components/product/ProductGrid";
import { catalogApi } from "@/lib/api/catalog";
import { normalizeSearchParams, withQuery } from "@/lib/utils/query";

export const metadata: Metadata = { title: "محصولات" };
export const dynamic = "force-dynamic";

const SORT_OPTIONS: { value: ProductSortOption; label: string }[] = [
  { value: "newest", label: "جدیدترین" },
  { value: "price_asc", label: "ارزان‌ترین" },
  { value: "price_desc", label: "گران‌ترین" },
  { value: "discounted", label: "تخفیف‌دار" },
];

interface ProductsPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const current = normalizeSearchParams(searchParams);
  const page = Number(current.page ?? 1) || 1;

  const result = await catalogApi.list({
    page,
    category: current.category,
    search: current.search,
    sort: (current.sort as ProductSortOption | undefined) ?? "newest",
    minPrice: current.minPrice ? Number(current.minPrice) : undefined,
    maxPrice: current.maxPrice ? Number(current.maxPrice) : undefined,
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="type-h1 mb-6">محصولات</h1>

      {/* فرم فیلتر با GET بومی — بدون هیچ JavaScript کار می‌کند */}
      <form
        method="get"
        className="mb-8 grid gap-4 rounded-lg border border-border bg-ivory-soft p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        {current.category && <input type="hidden" name="category" value={current.category} />}
        <div className="lg:col-span-2">
          <Input
            label="جستجو"
            name="search"
            defaultValue={current.search}
            placeholder="نام محصول…"
          />
        </div>
        <Select label="مرتب‌سازی" name="sort" defaultValue={current.sort ?? "newest"}>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Input
          label="حداقل قیمت (تومان)"
          name="minPrice"
          type="number"
          min={0}
          defaultValue={current.minPrice}
        />
        <Input
          label="حداکثر قیمت (تومان)"
          name="maxPrice"
          type="number"
          min={0}
          defaultValue={current.maxPrice}
        />
        <div className="flex items-end gap-2 lg:col-span-5">
          <Button type="submit">اعمال فیلتر</Button>
          {(current.search || current.sort || current.minPrice || current.maxPrice) && (
            <a
              href={current.category ? `/products?category=${current.category}` : "/products"}
              className={buttonClasses({ variant: "ghost" })}
            >
              حذف فیلترها
            </a>
          )}
        </div>
      </form>

      <ProductGrid products={result.data} />

      <Pagination
        page={result.pagination.page}
        totalPages={result.pagination.totalPages}
        buildHref={(target) =>
          withQuery("/products", current, { page: target === 1 ? undefined : target })
        }
        className="mt-10"
      />
    </main>
  );
}
