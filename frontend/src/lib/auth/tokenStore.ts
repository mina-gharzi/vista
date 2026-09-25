/**
 * Access Token فقط در حافظه (متغیر ماژول) نگه داشته می‌شود؛ نه localStorage و نه Cookie قابل‌خواندن.
 * با Refresh صفحه از بین می‌رود و AuthProvider آن را با Refresh Cookie (httpOnly) بازیابی می‌کند.
 * این ماژول عمداً هیچ Import ندارد تا هم client.ts و هم session.ts بتوانند از آن استفاده کنند (بدون Circular Import).
 */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
