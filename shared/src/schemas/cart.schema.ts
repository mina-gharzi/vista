import { z } from "zod";

const variantIdSchema = z.string().uuid("شناسه تنوع معتبر نیست");
const quantitySchema = z
  .number()
  .int("تعداد باید عدد صحیح باشد")
  .min(1, "تعداد باید حداقل ۱ باشد")
  .max(99);

export const addCartItemSchema = z.object({
  variantId: variantIdSchema,
  quantity: quantitySchema.default(1),
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

export const updateCartItemSchema = z.object({
  quantity: quantitySchema,
});

export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

export const cartItemParamSchema = z.object({ variantId: variantIdSchema });
