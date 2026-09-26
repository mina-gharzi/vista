import type { ProductCardSummary } from "@vista/shared";
import { EmptyState } from "@/components/ui";
import { ProductCard } from "./ProductCard";

export function ProductGrid({ products }: { products: ProductCardSummary[] }) {
  if (products.length === 0) {
    return (
      <EmptyState
        title="محصولی پیدا نشد"
        description="فیلترها را تغییر دهید یا بعداً دوباره سر بزنید."
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
