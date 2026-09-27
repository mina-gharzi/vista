export interface CartItemSummary {
  variantId: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  imageUrl: string | null;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  /** موجودی فعلی همان Variant (ممکن است از لحظه افزودن به سبد کم شده باشد) */
  availableStock: number;
  /** false یعنی محصول دیگر منتشرشده نیست یا موجودی کافی برای همین quantity ندارد */
  isAvailable: boolean;
}

export interface CartSummary {
  items: CartItemSummary[];
  itemCount: number;
  subtotal: number;
}
