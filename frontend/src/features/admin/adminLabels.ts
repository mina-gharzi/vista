import type { SellerStatus, ProductStatusValue } from "@vista/shared";
import type { BadgeVariant } from "@/components/ui";

export const sellerStatusBadge: Record<SellerStatus, BadgeVariant> = {
  PENDING: "warning",
  APPROVED: "success",
  SUSPENDED: "danger",
  REJECTED: "neutral",
};

export const productStatusBadge: Record<ProductStatusValue, BadgeVariant> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  ARCHIVED: "danger",
};
