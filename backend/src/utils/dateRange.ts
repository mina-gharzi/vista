/**
 * بازه‌های تاریخ بر اساس «روز تهران». ایران از ۱۴۰۱ ساعت تابستانی ندارد و آفست ثابت +03:30 است؛
 * بنابراین «تا تاریخ ۲۰۲۶-۱۰-۱۰» یعنی تمام آن روز به وقت تهران، نه UTC.
 */
const TEHRAN_OFFSET = "+03:30";
const DAY_MS = 86_400_000;

/** شروع روز (شامل) */
export function tehranDayStart(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00${TEHRAN_OFFSET}`);
}

/** شروع روز بعد (حد بالای انحصاری برای «تا تاریخ») */
export function tehranNextDayStart(dateOnly: string): Date {
  return new Date(tehranDayStart(dateOnly).getTime() + DAY_MS);
}
