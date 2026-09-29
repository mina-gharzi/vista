import type { WishlistItemSummary } from "@vista/shared";
import { apiRequest } from "./client";

export const wishlistApi = {
  list: () => apiRequest<WishlistItemSummary[]>("/wishlist", { auth: true }),
  getStatus: (productId: string) =>
    apiRequest<{ isWishlisted: boolean }>(`/wishlist/${productId}`, { auth: true }),
  add: (productId: string) =>
    apiRequest<WishlistItemSummary[]>("/wishlist", {
      method: "POST",
      auth: true,
      body: { productId },
    }),
  remove: (productId: string) =>
    apiRequest<WishlistItemSummary[]>(`/wishlist/${productId}`, { method: "DELETE", auth: true }),
};
