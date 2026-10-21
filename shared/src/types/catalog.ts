/** یک کارت محصول در فهرست/جستجو (نمای فشرده) */
export interface ProductCardSummary {
  id: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  categoryName: string;
  /** نام و slug فروشگاه (اطلاعات عمومی ویترین؛ هیچ داده داخلی فروشنده نیست) */
  sellerStoreName: string;
  sellerStoreSlug: string;
  /** حداقل یک تنوع فعال با موجودی > ۰ دارد */
  inStock: boolean;
}

export interface PublicProductVariant {
  id: string;
  size: string;
  color: string;
  /** null یعنی basePrice محصول ملاک قیمت است */
  price: number | null;
  stock: number;
}

export interface PublicProductImage {
  url: string;
  altText: string | null;
}

/** نمای عمومی کامل یک محصول منتشرشده (صفحه جزئیات) */
export interface PublicProductDetail {
  id: string;
  slug: string;
  title: string;
  description: string;
  basePrice: number;
  compareAtPrice: number | null;
  images: PublicProductImage[];
  variants: PublicProductVariant[];
  category: { id: string; name: string; slug: string };
  sellerStoreName: string;
  sellerStoreSlug: string;
}

/** رنگ‌ها/سایزهای موجود و بازهٔ قیمت در محدودهٔ دسته/جستجو (برای ساخت فیلترها) */
export interface CatalogFilterOptions {
  colors: string[];
  sizes: string[];
  priceRange: { min: number; max: number } | null;
}

export type ProductSortOption = "newest" | "price_asc" | "price_desc" | "discounted";
