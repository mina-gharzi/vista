import type { Prisma, PrismaClient } from "@prisma/client";
import type { ProductStatusValue, SellerStatus } from "@vista/shared";
import { AUDIT_ENTRY_SELECT, toAuditCreateData, type AuditInput, type AuditRow } from "./admin.audit";

export interface SellerListRow {
  id: string;
  storeName: string;
  storeSlug: string;
  status: SellerStatus;
  createdAt: Date;
  ownerName: string;
  ownerEmail: string;
  productCount: number;
}

export interface SellerDetailRow {
  id: string;
  storeName: string;
  storeSlug: string;
  description: string | null;
  status: SellerStatus;
  statusReason: string | null;
  statusChangedAt: Date | null;
  createdAt: Date;
  owner: { name: string; email: string; phone: string | null; registeredAt: Date };
  products: Record<ProductStatusValue, number>;
  sellerOrderCount: number;
  history: AuditRow[];
}

export interface SellerStatusChange {
  sellerId: string;
  from: SellerStatus;
  to: SellerStatus;
  reason: string | null;
  adminId: string;
}

export interface AdminSellersRepository {
  list(params: {
    page: number;
    limit: number;
    q?: string | undefined;
    status?: SellerStatus | undefined;
  }): Promise<{ items: SellerListRow[]; total: number }>;
  findDetail(sellerId: string): Promise<SellerDetailRow | null>;
  /**
   * اتمیک (یک Transaction): Compare-and-Set وضعیت (فقط اگر هنوز `from` باشد) + ارتقای نقش مالک به SELLER
   * هنگام تأیید + ثبت ممیزی. false یعنی وضعیت بین بررسی و نوشتن عوض شده و هیچ‌چیز نوشته نشده است.
   */
  changeStatus(change: SellerStatusChange): Promise<boolean>;
}

export function sellerAuditInput(change: SellerStatusChange): AuditInput {
  return {
    adminId: change.adminId,
    action: "SELLER_STATUS_CHANGED",
    targetType: "SELLER",
    targetId: change.sellerId,
    fromStatus: change.from,
    toStatus: change.to,
    reason: change.reason,
  };
}

export function createAdminSellersRepository(prisma: PrismaClient): AdminSellersRepository {
  return {
    async list({ page, limit, q, status }) {
      const where: Prisma.SellerWhereInput = {
        ...(status ? { status } : {}),
        ...(q
          ? {
              OR: [
                { storeName: { contains: q, mode: "insensitive" } },
                { storeSlug: { contains: q, mode: "insensitive" } },
                { user: { email: { contains: q, mode: "insensitive" } } },
                { user: { fullName: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      };
      const [rows, total] = await Promise.all([
        prisma.seller.findMany({
          where,
          select: {
            id: true,
            storeName: true,
            storeSlug: true,
            status: true,
            createdAt: true,
            user: { select: { fullName: true, email: true } },
            _count: { select: { products: true } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.seller.count({ where }),
      ]);
      return {
        total,
        items: rows.map((row) => ({
          id: row.id,
          storeName: row.storeName,
          storeSlug: row.storeSlug,
          status: row.status,
          createdAt: row.createdAt,
          ownerName: row.user.fullName,
          ownerEmail: row.user.email,
          productCount: row._count.products,
        })),
      };
    },

    async findDetail(sellerId) {
      const seller = await prisma.seller.findUnique({
        where: { id: sellerId },
        select: {
          id: true,
          storeName: true,
          storeSlug: true,
          description: true,
          status: true,
          statusReason: true,
          statusChangedAt: true,
          createdAt: true,
          user: { select: { fullName: true, email: true, phone: true, createdAt: true } },
        },
      });
      if (!seller) return null;

      const [grouped, sellerOrderCount, history] = await Promise.all([
        prisma.product.groupBy({ by: ["status"], where: { sellerId }, _count: { _all: true } }),
        prisma.sellerOrder.count({ where: { sellerId } }),
        prisma.adminAuditLog.findMany({
          where: { targetType: "SELLER", targetId: sellerId },
          select: AUDIT_ENTRY_SELECT,
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
      ]);
      const products: Record<ProductStatusValue, number> = { DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0 };
      for (const group of grouped) products[group.status] = group._count._all;

      return {
        id: seller.id,
        storeName: seller.storeName,
        storeSlug: seller.storeSlug,
        description: seller.description,
        status: seller.status,
        statusReason: seller.statusReason,
        statusChangedAt: seller.statusChangedAt,
        createdAt: seller.createdAt,
        owner: {
          name: seller.user.fullName,
          email: seller.user.email,
          phone: seller.user.phone,
          registeredAt: seller.user.createdAt,
        },
        products,
        sellerOrderCount,
        history,
      };
    },

    changeStatus(change) {
      return prisma.$transaction(async (tx) => {
        const result = await tx.seller.updateMany({
          where: { id: change.sellerId, status: change.from },
          data: {
            status: change.to,
            statusReason: change.reason,
            statusChangedAt: new Date(),
          },
        });
        if (result.count !== 1) return false;

        if (change.to === "APPROVED") {
          const seller = await tx.seller.findUniqueOrThrow({
            where: { id: change.sellerId },
            select: { userId: true },
          });
          // فقط CUSTOMER → SELLER؛ نقش ADMIN هرگز تغییر نمی‌کند
          await tx.user.updateMany({
            where: { id: seller.userId, role: "CUSTOMER" },
            data: { role: "SELLER" },
          });
        }
        await tx.adminAuditLog.create({ data: toAuditCreateData(sellerAuditInput(change)) });
        return true;
      });
    },
  };
}
