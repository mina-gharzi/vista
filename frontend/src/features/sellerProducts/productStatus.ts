import type { ProductStatus } from "@vista/shared";
import type { BadgeVariant } from "@/components/ui";

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  DRAFT: "پیش‌نویس",
  PUBLISHED: "منتشر شده",
  ARCHIVED: "آرشیو شده",
};

export const PRODUCT_STATUS_VARIANT: Record<ProductStatus, BadgeVariant> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  ARCHIVED: "warning",
};

export interface ProductActions {
  edit: boolean;
  publish: boolean;
  unpublish: boolean;
  archive: boolean;
}

/** فقط اقدام‌هایی که وضعیت فعلی پشتیبانی می‌کند (همان ALLOWED_TRANSITIONS بک‌اند؛ مرجع نهایی بک‌اند است) */
export function actionsFor(status: ProductStatus): ProductActions {
  switch (status) {
    case "DRAFT":
      return { edit: true, publish: true, unpublish: false, archive: true };
    case "PUBLISHED":
      return { edit: true, publish: false, unpublish: true, archive: true };
    case "ARCHIVED":
      return { edit: false, publish: false, unpublish: false, archive: false };
  }
}
