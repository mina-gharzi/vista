import type { AuthSession } from "@vista/shared";
import { authApi } from "@/lib/api/auth";
import { ApiRequestError, registerRefreshHandler } from "@/lib/api/client";
import { setAccessToken } from "./tokenStore";

let inFlight: Promise<AuthSession | null> | null = null;
const endListeners = new Set<() => void>();

/** وقتی Session پایان یافته (Refresh رد شد) اطلاع داده می‌شود تا UI به حالت «مهمان» برود. */
export function subscribeToSessionEnd(listener: () => void): () => void {
  endListeners.add(listener);
  return () => endListeners.delete(listener);
}

/**
 * تمدید Session با Refresh Cookie.
 * Single-flight: چند فراخوانی همزمان (React StrictMode، چند درخواست 401 هم‌زمان) فقط «یک» درخواست
 * Refresh می‌فرستند؛ چون Backend توکن را Rotate می‌کند و ارسال همزمان توکن یکسان باید اتفاق نیفتد.
 *
 * - موفق: Access Token جدید ذخیره و AuthSession برمی‌گردد.
 * - 401 یعنی نشست معتبر نیست: null (و اطلاع‌رسانی پایان Session).
 * - خطای شبکه/سرور: پرتاب می‌شود و Session «پاک نمی‌شود» (ممکن است مشکل موقتی باشد).
 */
export function refreshSession(): Promise<AuthSession | null> {
  if (inFlight) return inFlight;

  inFlight = authApi
    .refresh()
    .then((session) => {
      setAccessToken(session.accessToken);
      return session;
    })
    .catch((error: unknown) => {
      if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
        setAccessToken(null);
        endListeners.forEach((listener) => listener());
        return null;
      }
      throw error;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

// اتصال به API Client: درخواست‌های `auth: true` هنگام 401 از همین مسیر Session را تمدید می‌کنند
registerRefreshHandler(async () => {
  try {
    return (await refreshSession())?.accessToken ?? null;
  } catch {
    return null;
  }
});
