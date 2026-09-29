import { z } from "zod";

const productIdSchema = z.string().uuid("شناسه محصول معتبر نیست");

export const addWishlistItemSchema = z.object({ productId: productIdSchema });
export type AddWishlistItemInput = z.infer<typeof addWishlistItemSchema>;

export const wishlistProductParamSchema = z.object({ productId: productIdSchema });
