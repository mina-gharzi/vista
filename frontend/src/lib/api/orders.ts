import type {
  CheckoutInput,
  OrderDetail,
  OrderListItem,
  OrderStatus,
  PaginatedResponse,
} from "@vista/shared";
import { apiRequest } from "./client";

export const ordersApi = {
  checkout: (input: CheckoutInput) =>
    apiRequest<OrderDetail>("/checkout", { method: "POST", auth: true, body: input }),
  list: (page = 1, status?: OrderStatus) => {
    const query = new URLSearchParams({ page: String(page) });
    if (status) query.set("status", status);
    return apiRequest<PaginatedResponse<OrderListItem>>(`/orders?${query.toString()}`, {
      auth: true,
    });
  },
  getById: (id: string) => apiRequest<OrderDetail>(`/orders/${id}`, { auth: true }),
  cancel: (id: string) =>
    apiRequest<OrderDetail>(`/orders/${id}/cancel`, { method: "POST", auth: true }),
};
