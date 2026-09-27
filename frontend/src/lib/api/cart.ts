import type { AddCartItemInput, CartSummary, UpdateCartItemInput } from "@vista/shared";
import { apiRequest } from "./client";

/** همه Endpointها auth:true هستند — سبد خرید مخصوص کاربر واردشده است. */
export const cartApi = {
  get: () => apiRequest<CartSummary>("/cart", { auth: true }),

  addItem: (input: AddCartItemInput) =>
    apiRequest<CartSummary>("/cart", { method: "POST", auth: true, body: input }),

  updateItem: (variantId: string, input: UpdateCartItemInput) =>
    apiRequest<CartSummary>(`/cart/${encodeURIComponent(variantId)}`, {
      method: "PATCH",
      auth: true,
      body: input,
    }),

  removeItem: (variantId: string) =>
    apiRequest<CartSummary>(`/cart/${encodeURIComponent(variantId)}`, {
      method: "DELETE",
      auth: true,
    }),
};
