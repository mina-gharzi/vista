import argon2 from "argon2";

/** پارامترهای پیشنهادی OWASP برای Argon2id (m=19MiB, t=2, p=1). */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

/** هرگز Throw نمی‌کند؛ هش خراب یا نامعتبر یعنی رمز نادرست. */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

let dummyHashPromise: Promise<string> | undefined;

/**
 * هش ساختگی برای یکسان‌سازی زمان پاسخ Login وقتی ایمیل وجود ندارد
 * (جلوگیری از User Enumeration با Timing Attack).
 */
export function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword("vista-dummy-password-for-timing");
  return dummyHashPromise;
}
