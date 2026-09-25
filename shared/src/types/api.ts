/**
 * ساختار استاندارد پاسخ‌های Paginated طبق بخش ۲۱ پرامپت مادر.
 * تمام Endpointهای لیستی (محصولات، سفارشات، ریویوها و ...) باید از همین شکل پیروی کنند.
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * ساختار استاندارد خطا که از Error Handler مرکزی Backend برمی‌گردد.
 * هرگز Stack Trace یا اطلاعات حساس در Production ارسال نمی‌شود.
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
