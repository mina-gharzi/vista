import {
  PRODUCT_ADMIN_TRANSITIONS,
  PRODUCT_STATUS_LABEL,
  type AdminProductDetail,
  type AdminProductList,
  type AdminProductStatusInput,
  type AdminProductsQuery,
  type ProductAdminTarget,
} from "@vista/shared";
import { ConflictError, NotFoundError } from "../../errors/AppError";
import { toAuditEntry } from "./admin.audit";
import type {
  AdminProductsRepository,
  ProductDetailRow,
  ProductListRow,
} from "./adminProducts.repository";

export interface AdminProductsService {
  list(query: AdminProductsQuery): Promise<AdminProductList>;
  getDetail(productId: string): Promise<AdminProductDetail>;
  changeStatus(adminId: string, productId: string, input: AdminProductStatusInput): Promise<AdminProductDetail>;
}

function toListItem(row: ProductListRow) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    basePrice: row.basePrice,
    categoryName: row.categoryName,
    sellerId: row.sellerId,
    sellerName: row.sellerName,
    sellerStatus: row.sellerStatus,
    sellerBlocked: row.sellerStatus !== "APPROVED",
    totalStock: row.totalStock,
    createdAt: row.createdAt.toISOString(),
  };
}

function toDetail(row: ProductDetailRow): AdminProductDetail {
  return {
    ...toListItem(row),
    description: row.description,
    compareAtPrice: row.compareAtPrice,
    images: row.images,
    variants: row.variants,
    allowedTransitions: [...PRODUCT_ADMIN_TRANSITIONS[row.status]],
    history: row.history.map(toAuditEntry),
  };
}

export function createAdminProductsService(repository: AdminProductsRepository): AdminProductsService {
  async function requireDetail(productId: string): Promise<ProductDetailRow> {
    const row = await repository.findDetail(productId);
    if (!row) throw new NotFoundError("محصول یافت نشد");
    return row;
  }

  return {
    async list(query) {
      const { items, total } = await repository.list(query);
      return {
        data: items.map(toListItem),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
      };
    },

    async getDetail(productId) {
      return toDetail(await requireDetail(productId));
    },

    async changeStatus(adminId, productId, input) {
      const current = await requireDetail(productId);
      const target = input.status as ProductAdminTarget;
      if (!PRODUCT_ADMIN_TRANSITIONS[current.status].includes(target)) {
        throw new ConflictError(
          `تغییر وضعیت محصول از «${PRODUCT_STATUS_LABEL[current.status]}» به «${PRODUCT_STATUS_LABEL[target]}» مجاز نیست.`,
        );
      }
      const changed = await repository.changeStatus({
        productId,
        from: current.status,
        to: target,
        reason: input.reason,
        adminId,
      });
      if (!changed) throw new ConflictError("وضعیت این محصول همزمان تغییر کرد. صفحه را تازه کنید.");
      return toDetail(await requireDetail(productId));
    },
  };
}
