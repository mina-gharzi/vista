import { z } from "zod";

/**
 * این Schemaها هم در Backend (به‌عنوان Validator نهایی و معتبر) و
 * هم در Frontend (فقط برای UX بهتر و نمایش خطای فوری) استفاده می‌شوند.
 * طبق بخش ۲۴ پرامپت مادر: Frontend Validation هرگز جایگزین Backend Validation نیست.
 */

/** قوانین رمز جدید (Register و تغییر رمز). سقف طول: جلوگیری از DoS با هش‌کردن رمزهای بسیار بلند (Argon2 پرهزینه است) */
export const passwordSchema = z
  .string()
  .min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد")
  .max(128, "رمز عبور نباید بیشتر از ۱۲۸ کاراکتر باشد")
  .regex(/[A-Z]/, "رمز عبور باید حداقل یک حرف بزرگ داشته باشد")
  .regex(/[a-z]/, "رمز عبور باید حداقل یک حرف کوچک داشته باشد")
  .regex(/[0-9]/, "رمز عبور باید حداقل یک عدد داشته باشد");

export const registerSchema = z.object({
  fullName: z.string().trim().min(3, "نام باید حداقل ۳ کاراکتر باشد").max(100),
  email: z.string().trim().email("ایمیل معتبر نیست").toLowerCase(),
  password: passwordSchema,
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

const optionalPhoneSchema = z.union([
  // رشته خالی یعنی «حذف شماره موبایل»
  z.literal("").transform(() => null),
  z.null(),
  z
    .string()
    .trim()
    .regex(/^09\d{9}$/, "شماره موبایل معتبر نیست (مثال: 09123456789)"),
]);

/** ویرایش اطلاعات شخصی. ایمیل و نقش عمداً قابل ویرایش نیستند (Mass Assignment). */
export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(3, "نام باید حداقل ۳ کاراکتر باشد").max(100).optional(),
    phone: optionalPhoneSchema.optional(),
  })
  .refine((data) => data.fullName !== undefined || data.phone !== undefined, {
    message: "حداقل یک فیلد برای ویرایش لازم است",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "رمز فعلی الزامی است").max(128),
    newPassword: passwordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    path: ["newPassword"],
    message: "رمز جدید باید با رمز فعلی متفاوت باشد",
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
