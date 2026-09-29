export interface WishlistItemSummary {
  productId: string;
  productSlug: string;
  productTitle: string;
  imageUrl: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  categoryName: string;
  /** false یعنی محصول دیگر منتشرشده نیست (پنهان نمی‌شود، فقط علامت‌گذاری می‌شود) */
  isAvailable: boolean;
  addedAt: string;
}
