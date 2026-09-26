import type { ProductCardSummary } from "@vista/shared";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { formatPrice } from "@/lib/utils/format";

export function ProductCard({ product }: { product: ProductCardSummary }) {
  const hasDiscount = product.compareAtPrice !== null && product.compareAtPrice > product.basePrice;
  const discountPercent = hasDiscount
    ? Math.round((1 - product.basePrice / (product.compareAtPrice as number)) * 100)
    : 0;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col gap-3 rounded-lg border border-border bg-ivory-soft p-3 transition-shadow hover:shadow-overlay"
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded bg-ivory">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- تصاویر از دامنه‌های متنوع فروشندگان می‌آیند
          <img
            src={product.imageUrl}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-faint">
            بدون تصویر
          </div>
        )}
        {hasDiscount && (
          <Badge variant="premium" className="absolute start-2 top-2">
            ٪{discountPercent} تخفیف
          </Badge>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <p className="type-caption">{product.categoryName}</p>
        <h3 className="line-clamp-2 text-sm font-medium text-ink">{product.title}</h3>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="type-price">{formatPrice(product.basePrice)}</span>
          {hasDiscount && (
            <span className="text-xs text-ink-faint line-through">
              {formatPrice(product.compareAtPrice as number)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
