import type { AddressInput, AddressSummary, UpdateAddressInput } from "@vista/shared";
import { apiRequest } from "./client";

export const addressesApi = {
  list: () => apiRequest<AddressSummary[]>("/addresses", { auth: true }),
  create: (input: AddressInput) =>
    apiRequest<AddressSummary>("/addresses", { method: "POST", auth: true, body: input }),
  update: (id: string, input: UpdateAddressInput) =>
    apiRequest<AddressSummary>(`/addresses/${id}`, { method: "PATCH", auth: true, body: input }),
  remove: (id: string) => apiRequest<null>(`/addresses/${id}`, { method: "DELETE", auth: true }),
};
