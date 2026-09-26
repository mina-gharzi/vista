import type { ProductCardSummary, PublicProductDetail } from "@vista/shared";
import type { ProductCardRow, ProductDetailRow } from "./catalog.repository";

export function toProductCard(row: ProductCardRow): ProductCardSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    imageUrl: row.images[0]?.url ?? null,
    basePrice: row.basePrice,
    compareAtPrice: row.compareAtPrice,
    categoryName: row.category.name,
  };
}

export function toProductDetail(row: ProductDetailRow): PublicProductDetail {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    basePrice: row.basePrice,
    compareAtPrice: row.compareAtPrice,
    images: row.images,
    variants: row.variants,
    category: row.category,
    sellerStoreName: row.seller.storeName,
  };
}
