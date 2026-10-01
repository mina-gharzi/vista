export interface ReviewSummary {
  id: string;
  userName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  /** true فقط اگر بیننده فعلی وارد شده باشد و نویسنده همین ریویو باشد */
  isMine: boolean;
}

export interface ProductReviewsResult {
  reviews: ReviewSummary[];
  average: number;
  count: number;
}

/** خلاصه‌ای که در کارت/جزئیات محصول برای نمایش ستاره کنار قیمت لازم است */
export interface ProductRatingSummary {
  average: number;
  count: number;
}
