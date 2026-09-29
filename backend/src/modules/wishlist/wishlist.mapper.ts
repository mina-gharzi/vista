import type { WishlistItemSummary } from "@vista/shared";
import type { WishlistItemRow } from "./wishlist.repository";

export function toWishlistItem(row: WishlistItemRow): WishlistItemSummary {
  return {
    productId: row.productId,
    productSlug: row.product.slug,
    productTitle: row.product.title,
    imageUrl: row.product.images[0]?.url ?? null,
    basePrice: row.product.basePrice,
    compareAtPrice: row.product.compareAtPrice,
    categoryName: row.product.category.name,
    isAvailable: row.product.status === "PUBLISHED",
    addedAt: row.createdAt.toISOString(),
  };
}
