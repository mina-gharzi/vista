import type { ApplySellerInput, SellerApplication, SellerApplicationStatus } from "@vista/shared";
import { apiRequest } from "./client";

/** فقط Wrapperهای Endpointهای ثبت‌نام فروشنده. هویت کاربر همیشه از توکن سمت سرور می‌آید. */
export const sellerApi = {
  apply: (input: ApplySellerInput) =>
    apiRequest<SellerApplication>("/seller/apply", { method: "POST", auth: true, body: input }),

  getApplicationStatus: () =>
    apiRequest<SellerApplicationStatus>("/seller/application/status", { auth: true }),
};
