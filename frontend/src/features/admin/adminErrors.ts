import { ApiRequestError } from "@/lib/api/client";
import { firstBackendErrors } from "@/lib/utils/zod";

export interface DescribedAdminError {
  fieldErrors: Record<string, string>;
  message: string;
  /** 409/404: داده صفحه کهنه است و باید از سرور تازه شود */
  stale: boolean;
}

const GENERIC = "عملیات انجام نشد. لطفاً دوباره تلاش کنید.";

/** هر خطا را به پیام فارسی امن تبدیل می‌کند؛ پیام خام 5xx هرگز نشان داده نمی‌شود. */
export function describeAdminError(error: unknown): DescribedAdminError {
  if (!(error instanceof ApiRequestError)) return { fieldErrors: {}, message: GENERIC, stale: false };
  const fieldErrors = firstBackendErrors(error.details);
  if (error.code === "NETWORK_ERROR") return { fieldErrors, message: error.message, stale: false };
  if (error.status === 401) {
    return { fieldErrors, message: "نشست شما منقضی شده است. دوباره وارد شوید.", stale: false };
  }
  if (error.status === 403) return { fieldErrors, message: "شما اجازهٔ انجام این کار را ندارید.", stale: false };
  if (error.status === 404) return { fieldErrors, message: "مورد درخواستی یافت نشد.", stale: true };
  if (error.status === 409) return { fieldErrors, message: error.message, stale: true };
  if (error.status === 400 || error.status === 429) return { fieldErrors, message: error.message, stale: false };
  return { fieldErrors, message: GENERIC, stale: false };
}
