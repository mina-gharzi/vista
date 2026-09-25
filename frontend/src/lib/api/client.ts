import type { ApiResponse } from "@vista/shared";
import { API_BASE_URL } from "@/config/env";
import { getAccessToken } from "@/lib/auth/tokenStore";

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** true: Access Token فعلی ارسال می‌شود و در صورت 401 یک‌بار Refresh + تلاش مجدد انجام می‌شود */
  auth?: boolean;
  cache?: RequestCache;
  signal?: AbortSignal;
}

/**
 * تنها نقطه ارتباط Frontend با Backend. هیچ Component نباید مستقیماً fetch بنویسد —
 * همیشه از این تابع یا Wrapperهای مخصوص هر Domain در همین پوشه (auth.ts, products.ts, ...) استفاده شود.
 *
 * تمام خطاها (شبکه، پاسخ غیر JSON، خطای Backend) به یک نوع واحد `ApiRequestError` تبدیل می‌شوند
 * تا UI فقط یک شکل خطا را مدیریت کند.
 */
async function send<T>(
  path: string,
  options: RequestOptions,
  accessToken: string | null,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      credentials: "include", // برای ارسال httpOnly Refresh Token Cookie
      body: options.body !== undefined ? JSON.stringify(options.body) : null,
      cache: options.cache ?? "no-store",
      signal: options.signal ?? null,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error; // لغو درخواست توسط خود Caller خطا نیست
    }
    throw new ApiRequestError(
      0,
      "NETWORK_ERROR",
      "ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.",
    );
  }

  let json: ApiResponse<T> | null;
  try {
    json = await response.json();
  } catch {
    json = null; // مثلاً پاسخ HTML از Proxy/Gateway هنگام خطای 502
  }

  if (json === null) {
    throw new ApiRequestError(
      response.status,
      "INVALID_RESPONSE",
      "پاسخ نامعتبر از سرور دریافت شد.",
    );
  }

  if (!json.success) {
    throw new ApiRequestError(
      response.status,
      json.error.code,
      json.error.message,
      json.error.details,
    );
  }

  return json.data;
}

type RefreshHandler = () => Promise<string | null>;
let refreshHandler: RefreshHandler | null = null;

/** ماژول session (lib/auth/session.ts) خودش را اینجا ثبت می‌کند تا client.ts به آن Import وابسته نباشد. */
export function registerRefreshHandler(handler: RefreshHandler): void {
  refreshHandler = handler;
}

/**
 * درخواست‌های `auth: true` با Access Token ارسال می‌شوند. اگر Backend پاسخ 401 بدهد
 * (Access Token منقضی)، یک‌بار Session با Refresh Cookie تمدید و درخواست دقیقاً یک‌بار تکرار می‌شود.
 * اگر تمدید ممکن نبود همان خطای 401 به Caller برمی‌گردد.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await send<T>(path, options, options.auth ? getAccessToken() : null);
  } catch (error) {
    if (
      options.auth &&
      error instanceof ApiRequestError &&
      error.status === 401 &&
      refreshHandler
    ) {
      const freshToken = await refreshHandler();
      if (freshToken) {
        return send<T>(path, options, freshToken);
      }
    }
    throw error;
  }
}
