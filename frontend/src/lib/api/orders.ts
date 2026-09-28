import type { CheckoutInput, OrderDetail, OrderListItem, PaginatedResponse } from "@vista/shared";
import { apiRequest } from "./client";

export const ordersApi = {
  checkout: (input: CheckoutInput) =>
    apiRequest<OrderDetail>("/checkout", { method: "POST", auth: true, body: input }),
  list: (page = 1) =>
    apiRequest<PaginatedResponse<OrderListItem>>(`/orders?page=${page}`, { auth: true }),
  getById: (id: string) => apiRequest<OrderDetail>(`/orders/${id}`, { auth: true }),
};
