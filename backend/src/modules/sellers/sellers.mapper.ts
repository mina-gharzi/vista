import type { SellerApplication } from "@vista/shared";
import type { SellerRecord } from "./sellers.repository";

/** فقط فیلدهای عمومی؛ userId و شناسه‌های داخلی هرگز به Client نمی‌روند. */
export function toSellerApplication(record: SellerRecord): SellerApplication {
  return {
    storeName: record.storeName,
    storeSlug: record.storeSlug,
    description: record.description,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
