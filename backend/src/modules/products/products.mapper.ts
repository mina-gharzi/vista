import type { SellerProduct } from "@vista/shared";
import type { ProductWithRelations } from "./products.repository";

export function toSellerProduct(product: ProductWithRelations): SellerProduct {
  return {
    id: product.id,
    categoryId: product.categoryId,
    title: product.title,
    slug: product.slug,
    description: product.description,
    basePrice: product.basePrice,
    compareAtPrice: product.compareAtPrice,
    status: product.status,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      price: variant.price,
      stock: variant.stock,
      isActive: variant.isActive,
    })),
    images: product.images.map((image) => ({
      id: image.id,
      url: image.url,
      altText: image.altText,
      position: image.position,
    })),
  };
}
