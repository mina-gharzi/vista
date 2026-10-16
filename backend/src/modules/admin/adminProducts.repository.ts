import type { Prisma, PrismaClient } from "@prisma/client";
import type { ProductStatusValue, SellerStatus } from "@vista/shared";
import { AUDIT_ENTRY_SELECT, toAuditCreateData, type AuditInput, type AuditRow } from "./admin.audit";

export interface ProductListRow {
  id: string;
  title: string;
  slug: string;
  status: ProductStatusValue;
  basePrice: number;
  categoryName: string;
  sellerId: string;
  sellerName: string;
  sellerStatus: SellerStatus;
  totalStock: number;
  createdAt: Date;
}

export interface ProductDetailRow extends ProductListRow {
  description: string;
  compareAtPrice: number | null;
  images: { url: string; altText: string | null }[];
  variants: {
    id: string;
    size: string;
    color: string;
    sku: string;
    price: number | null;
    stock: number;
    isActive: boolean;
  }[];
  history: AuditRow[];
}

export interface ProductStatusChange {
  productId: string;
  from: ProductStatusValue;
  to: ProductStatusValue;
  reason: string;
  adminId: string;
}

export interface AdminProductsRepository {
  list(params: {
    page: number;
    limit: number;
    q?: string | undefined;
    status?: ProductStatusValue | undefined;
    categoryId?: string | undefined;
    sellerId?: string | undefined;
    blockedSellers?: boolean | undefined;
  }): Promise<{ items: ProductListRow[]; total: number }>;
  findDetail(productId: string): Promise<ProductDetailRow | null>;
  /**
   * اتمیک: Compare-and-Set روی status (فقط ستون اسکالر) + ثبت ممیزی در یک Transaction.
   * به تنوع‌ها، موجودی و سفارش‌های موجود دست نمی‌زند. false = وضعیت همزمان عوض شده.
   */
  changeStatus(change: ProductStatusChange): Promise<boolean>;
}

export function productAuditInput(change: ProductStatusChange): AuditInput {
  return {
    adminId: change.adminId,
    action: "PRODUCT_STATUS_CHANGED",
    targetType: "PRODUCT",
    targetId: change.productId,
    fromStatus: change.from,
    toStatus: change.to,
    reason: change.reason,
  };
}

const LIST_SELECT = {
  id: true,
  title: true,
  slug: true,
  status: true,
  basePrice: true,
  createdAt: true,
  category: { select: { name: true } },
  seller: { select: { id: true, storeName: true, status: true } },
  variants: { select: { stock: true } },
} satisfies Prisma.ProductSelect;

type ListRecord = Prisma.ProductGetPayload<{ select: typeof LIST_SELECT }>;

function toListRow(row: ListRecord): ProductListRow {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    basePrice: row.basePrice,
    categoryName: row.category.name,
    sellerId: row.seller.id,
    sellerName: row.seller.storeName,
    sellerStatus: row.seller.status,
    totalStock: row.variants.reduce((sum, v) => sum + v.stock, 0),
    createdAt: row.createdAt,
  };
}

export function createAdminProductsRepository(prisma: PrismaClient): AdminProductsRepository {
  return {
    async list({ page, limit, q, status, categoryId, sellerId, blockedSellers }) {
      const where: Prisma.ProductWhereInput = {
        ...(status ? { status } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(sellerId ? { sellerId } : {}),
        ...(blockedSellers === true ? { seller: { status: { not: "APPROVED" } } } : {}),
        ...(blockedSellers === false ? { seller: { status: "APPROVED" } } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { slug: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      };
      const [rows, total] = await Promise.all([
        prisma.product.findMany({
          where,
          select: LIST_SELECT,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.product.count({ where }),
      ]);
      return { items: rows.map(toListRow), total };
    },

    async findDetail(productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
          ...LIST_SELECT,
          description: true,
          compareAtPrice: true,
          images: { orderBy: { position: "asc" }, select: { url: true, altText: true } },
          variants: {
            orderBy: [{ size: "asc" }, { color: "asc" }],
            select: { id: true, size: true, color: true, sku: true, price: true, stock: true, isActive: true },
          },
        },
      });
      if (!product) return null;
      const history = await prisma.adminAuditLog.findMany({
        where: { targetType: "PRODUCT", targetId: productId },
        select: AUDIT_ENTRY_SELECT,
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return {
        ...toListRow(product),
        description: product.description,
        compareAtPrice: product.compareAtPrice,
        images: product.images,
        variants: product.variants,
        history,
      };
    },

    changeStatus(change) {
      return prisma.$transaction(async (tx) => {
        const result = await tx.product.updateMany({
          where: { id: change.productId, status: change.from },
          data: { status: change.to },
        });
        if (result.count !== 1) return false;
        await tx.adminAuditLog.create({ data: toAuditCreateData(productAuditInput(change)) });
        return true;
      });
    },
  };
}
