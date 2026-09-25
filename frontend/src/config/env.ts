/**
 * Environment Variableهای Frontend. فقط متغیرهای NEXT_PUBLIC_* اینجا خوانده می‌شوند.
 * نکته: Next فقط دسترسی «مستقیم» به process.env.NEXT_PUBLIC_X را در Build جایگزین می‌کند،
 * بنابراین از Destructure یا دسترسی داینامیک استفاده نشود.
 */
const apiUrl = process.env.NEXT_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error("NEXT_PUBLIC_API_URL تعریف نشده است — به .env.example مراجعه کنید");
}

export const API_BASE_URL: string = apiUrl.replace(/\/+$/, "");
