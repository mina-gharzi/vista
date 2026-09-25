type ClassValue = string | false | null | undefined;

/** ترکیب شرطی className ها (جایگزین سبک برای clsx؛ نیازی به وابستگی اضافه نیست). */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
