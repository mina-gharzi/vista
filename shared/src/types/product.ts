export type ProductStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface ProductVariantSummary {
  id: string;
  sku: string;
  size: string;
  color: string;
  /** null یعنی basePrice محصول ملاک است */
  price: number | null;
  stock: number;
  /** false = آرشیو شده؛ فقط فروشنده می‌بیند و در فروشگاه عمومی نمایش داده نمی‌شود */
  isActive: boolean;
}

/**
 * قیمت مؤثر یک تنوع: اگر قیمت اختصاصی دارد همان، وگرنه basePrice محصول.
 * تنها تعریف «قیمت مؤثر» در کل پروژه — Frontend و Backend هر دو از همین استفاده می‌کنند.
 */
export function getEffectivePrice(variant: { price: number | null }, basePrice: number): number {
  return variant.price ?? basePrice;
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
