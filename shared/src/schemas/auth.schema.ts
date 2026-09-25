import { z } from "zod";

/**
 * این Schemaها هم در Backend (به‌عنوان Validator نهایی و معتبر) و
 * هم در Frontend (فقط برای UX بهتر و نمایش خطای فوری) استفاده می‌شوند.
 * طبق بخش ۲۴ پرامپت مادر: Frontend Validation هرگز جایگزین Backend Validation نیست.
 */

export const registerSchema = z.object({
  fullName: z.string().trim().min(3, "نام باید حداقل ۳ کاراکتر باشد").max(100),
  email: z.string().trim().email("ایمیل معتبر نیست").toLowerCase(),
  password: z
    .string()
    .min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد")
    // سقف طول: جلوگیری از DoS با هش‌کردن رمزهای بسیار بلند (Argon2 پرهزینه است)
    .max(128, "رمز عبور نباید بیشتر از ۱۲۸ کاراکتر باشد")
    .regex(/[A-Z]/, "رمز عبور باید حداقل یک حرف بزرگ داشته باشد")
    .regex(/[a-z]/, "رمز عبور باید حداقل یک حرف کوچک داشته باشد")
    .regex(/[0-9]/, "رمز عبور باید حداقل یک عدد داشته باشد"),
  phone: z
    .string()
    .trim()
    .regex(/^09\d{9}$/, "شماره موبایل معتبر نیست")
    .optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email("ایمیل معتبر نیست").toLowerCase(),
  password: z.string().min(1, "رمز عبور الزامی است").max(128, "رمز عبور نامعتبر است"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
