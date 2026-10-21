import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductDiscoveryView } from "@/features/discovery/ProductDiscoveryView";
import type { ProductPage } from "@/features/discovery/useProductSearch";
import { catalogApi } from "@/lib/api/catalog";
import { normalizeSearchParams } from "@/lib/utils/query";
import { parseDiscoveryParams, toApiQuery, toSearchParams } from "@/lib/utils/discoveryState";

export const metadata: Metadata = { title: "محصولات" };
export const dynamic = "force-dynamic";

interface ProductsPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

/**
 * نتیجهٔ اولیه سمت سرور (SEO و بدون چشمک) گرفته می‌شود؛ هر تغییر بعدی توسط کلاینت و از روی URL انجام می‌شود.
 * اگر واکشی سرور شکست بخورد، کلاینت خودش دوباره تلاش می‌کند و خطای قابل‌تکرار نشان می‌دهد.
 */
export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const raw = normalizeSearchParams(searchParams);
  const filters = parseDiscoveryParams({ get: (name) => raw[name] ?? null });
  let initial: { key: string; result: ProductPage } | null = null;
  try {
    initial = { key: toSearchParams(filters).toString(), result: await catalogApi.list(toApiQuery(filters)) };
  } catch {
    initial = null;
  }

  return (
    <Suspense fallback={null}>
      <ProductDiscoveryView initial={initial} />
    </Suspense>
  );
}
