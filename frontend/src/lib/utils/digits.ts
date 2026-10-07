const PERSIAN_ZERO = "۰".charCodeAt(0);
const ARABIC_ZERO = "٠".charCodeAt(0);

/** ارقام فارسی/عربی → لاتین (کاربر ایرانی طبیعی است عدد را با کیبورد فارسی تایپ کند) */
export function toLatinDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (char) => {
    const code = char.charCodeAt(0);
    return String(code >= ARABIC_ZERO && code < ARABIC_ZERO + 10 ? code - ARABIC_ZERO : code - PERSIAN_ZERO);
  });
}

/**
 * ورودی عددی فرم → عدد. جداکننده‌های هزارگان (، , ٬ فاصله) نادیده گرفته می‌شوند.
 * رشته خالی → undefined (یعنی «وارد نشده»). مقدار نامعتبر → NaN تا Schema پیام خطا بدهد.
 */
export function parseNumberInput(value: string): number | undefined {
  const cleaned = toLatinDigits(value).replace(/[\s,،٬]/g, "");
  if (cleaned === "") return undefined;
  return /^\d+$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}
