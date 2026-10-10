import { ApiRequestError } from "@/lib/api/client";
import { firstBackendErrors } from "@/lib/utils/zod";

export interface DescribedInventoryError {
  fieldErrors: Record<string, string>;
  message: string;
  /** 401/403/404: ادامه کار روی همین Variant معنا ندارد */
  fatal: boolean;
}

const GENERIC = "عملیات انجام نشد. لطفاً دوباره تلاش کنید.";

/** هر خطا را به پیام فارسی امن تبدیل می‌کند؛ پیام خام 5xx یا Stack هرگز نشان داده نمی‌شود. */
export function describeInventoryError(error: unknown): DescribedInventoryError {
  if (!(error instanceof ApiRequestError)) return { fieldErrors: {}, message: GENERIC, fatal: false };
  const fieldErrors = firstBackendErrors(error.details);
  if (error.code === "NETWORK_ERROR") return { fieldErrors, message: error.message, fatal: false };
  if (error.status === 401) {
    return { fieldErrors, message: "نشست شما منقضی شده است. دوباره وارد شوید.", fatal: true };
  }
  if (error.status === 403) return { fieldErrors, message: error.message, fatal: true };
  if (error.status === 404) return { fieldErrors, message: "این تنوع یافت نشد.", fatal: true };
  if (error.status === 400 || error.status === 409 || error.status === 429) {
    return { fieldErrors, message: error.message, fatal: false };
  }
  return { fieldErrors, message: GENERIC, fatal: false };
}
