/**
 * Logger متمرکز. در فاز فعلی روی console پیاده شده اما نقطه واحدی است که بعداً
 * می‌توان بدون تغییر بقیه پروژه به Pino/Winston یا یک سرویس Log خارجی وصل کرد.
 *
 * هرگز از این Logger برای ثبت Password، Token، Secret یا اطلاعات حساس کاربر استفاده نشود.
 */
type LogMeta = Record<string, unknown>;

function format(level: string, message: string, meta?: LogMeta): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  return `[${timestamp}] [${level}] ${message}${metaStr}`;
}

export const logger = {
  info(message: string, meta?: LogMeta): void {
    // eslint-disable-next-line no-console
    console.log(format("INFO", message, meta));
  },
  warn(message: string, meta?: LogMeta): void {
    // eslint-disable-next-line no-console
    console.warn(format("WARN", message, meta));
  },
  error(message: string, meta?: LogMeta): void {
    // eslint-disable-next-line no-console
    console.error(format("ERROR", message, meta));
  },
};
