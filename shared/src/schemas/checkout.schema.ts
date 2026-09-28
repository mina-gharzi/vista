import { z } from "zod";

export const checkoutSchema = z.object({
  addressId: z.string().uuid("آدرس معتبر نیست"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const ordersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type OrdersQuery = z.infer<typeof ordersQuerySchema>;

export const orderIdParamSchema = z.object({ id: z.string().uuid("شناسه سفارش معتبر نیست") });
