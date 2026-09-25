export type ProductStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface ProductVariantSummary {
  id: string;
  sku: string;
  size: string;
  color: string;
  /** null یعنی basePrice محصول ملاک است */
  price: number | null;
  stock: number;
}

export interface ProductImageSummary {
  id: string;
  url: string;
  altText: string | null;
  position: number;
}

/** نمای کامل محصول برای Dashboard فروشنده (شامل Variant/Image/Status — نه برای نمایش عمومی) */
export interface SellerProduct {
  id: string;
  categoryId: string;
  title: string;
  slug: string;
  description: string;
  basePrice: number;
  compareAtPrice: number | null;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
  variants: ProductVariantSummary[];
  images: ProductImageSummary[];
}
