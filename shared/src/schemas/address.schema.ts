import { z } from "zod";

export const addressInputSchema = z.object({
  fullName: z.string().trim().min(2, "نام و نام خانوادگی الزامی است").max(100),
  phone: z
    .string()
    .trim()
    .regex(/^09\d{9}$/, "شماره موبایل معتبر نیست (مثال: 09123456789)"),
  province: z.string().trim().min(2, "استان الزامی است").max(60),
  city: z.string().trim().min(2, "شهر الزامی است").max(60),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "کد پستی باید ۱۰ رقم باشد"),
  addressLine: z.string().trim().min(5, "آدرس کامل را وارد کنید").max(300),
  isDefault: z.boolean().default(false),
});

export type AddressInput = z.infer<typeof addressInputSchema>;

export const updateAddressSchema = addressInputSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "حداقل یک فیلد برای ویرایش لازم است",
  });

export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;

export const addressIdParamSchema = z.object({ id: z.string().uuid("شناسه آدرس معتبر نیست") });
