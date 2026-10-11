import { ApiRequestError } from "@/lib/api/client";
import { firstBackendErrors } from "@/lib/utils/zod";

export interface DescribedOrderError {
  fieldErrors: Record<string, string>;
  message: string;
  /** 409: وضعیت سفارش در این فاصله عوض شده (داده کهنه) → باید از سرور تازه شود */
  conflict: boolean;
  /** 401/403/404: ادامه کار روی این سفارش معنا ندارد */
  fatal: boolean;
}

const GENERIC = "عملیات انجام نشد. لطفاً دوباره تلاش کنید.";

/** هر خطا را به پیام فارسی امن تبدیل می‌کند؛ پیام خام 5xx یا Stack هرگز نشان داده نمی‌شود. */
export function describeOrderError(error: unknown): DescribedOrderError {
  if (!(error instanceof ApiRequestError)) {
    return { fieldErrors: {}, message: GENERIC, conflict: false, fatal: false };
  }
  const fieldErrors = firstBackendErrors(error.details);
  if (error.code === "NETWORK_ERROR") {
    return { fieldErrors, message: error.message, conflict: false, fatal: false };
  }
  if (error.status === 401) {
    return { fieldErrors, message: "نشست شما منقضی شده است. دوباره وارد شوید.", conflict: false, fatal: true };
  }
  if (error.status === 403) return { fieldErrors, message: error.message, conflict: false, fatal: true };
  if (error.status === 404) return { fieldErrors, message: "این سفارش یافت نشد.", conflict: false, fatal: true };
  if (error.status === 409) return { fieldErrors, message: error.message, conflict: true, fatal: false };
  if (error.status === 400 || error.status === 429) {
    return { fieldErrors, message: error.message, conflict: false, fatal: false };
  }
  return { fieldErrors, message: GENERIC, conflict: false, fatal: false };
}
