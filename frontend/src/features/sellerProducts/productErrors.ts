import { ApiRequestError } from "@/lib/api/client";
import { firstBackendErrors } from "@/lib/utils/zod";

export interface DescribedError {
  /** خطای فیلدها (اگر Backend برای فیلد مشخصی پیام داده باشد) */
  fieldErrors: Record<string, string>;
  /** پیام کلی قابل‌نمایش بالای فرم/Toast */
  message: string;
  /** دلایل ناتمام‌بودن برای انتشار */
  reasons: string[];
  /** 401/403/404: ادامه کار در این صفحه معنا ندارد */
  fatal: boolean;
}

const GENERIC = "عملیات انجام نشد. لطفاً دوباره تلاش کنید.";

/** تبدیل هر خطا به قالب قابل‌نمایش؛ پیام خام 5xx هرگز نشان داده نمی‌شود. */
export function describeProductError(error: unknown): DescribedError {
  if (!(error instanceof ApiRequestError)) {
    return { fieldErrors: {}, message: GENERIC, reasons: [], fatal: false };
  }
  const details = error.details ?? {};
  const fieldErrors = firstBackendErrors(
    Object.fromEntries(Object.entries(details).filter(([key]) => key !== "status")),
  );
  const reasons = details.status ?? [];

  if (error.code === "NETWORK_ERROR") {
    return { fieldErrors, message: error.message, reasons, fatal: false };
  }
  if (error.status === 401) {
    return { fieldErrors, message: "نشست شما منقضی شده است. دوباره وارد شوید.", reasons, fatal: true };
  }
  if (error.status === 403) {
    return { fieldErrors, message: error.message, reasons, fatal: true };
  }
  if (error.status === 404) {
    return { fieldErrors, message: "محصول یافت نشد.", reasons, fatal: true };
  }
  if (error.status === 400 || error.status === 409 || error.status === 429) {
    return { fieldErrors, message: error.message, reasons, fatal: false };
  }
  return { fieldErrors, message: GENERIC, reasons, fatal: false };
}
