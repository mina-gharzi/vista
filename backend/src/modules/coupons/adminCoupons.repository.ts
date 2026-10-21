import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { AdminCouponStats, CouponDiscountType } from "@vista/shared";
import {
  AUDIT_ENTRY_SELECT,
  toAuditCreateData,
  type AuditInput,
  type AuditRow,
} from "../admin/admin.audit";

export interface CouponRecord {
  id: string;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount: number | null;
  minPurchaseAmount: number | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  sellerId: string | null;
  productIds: string[];
  categoryIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminCouponRow extends CouponRecord {
  sellerName: string | null;
}

export interface AdminCouponDetailRow extends AdminCouponRow {
  products: { id: string; title: string }[];
  categories: { id: string; name: string }[];
  stats: AdminCouponStats;
  history: AuditRow[];
}

/** فیلدهای قابل‌نوشتن (کد فقط هنگام ساخت) */
export interface CouponEditableData {
  description: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount: number | null;
  minPurchaseAmount: number | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  sellerId: string | null;
  productIds: string[];
  categoryIds: string[];
}

export interface CouponCreateData extends CouponEditableData {
  code: string;
  isActive: boolean;
}

export interface AdminCouponsListParams {
  page: number;
  limit: number;
  q?: string | undefined;
  isActive?: boolean | undefined;
}

/** نقض یکتایی کد در دیتابیس (آخرین خط دفاع در برابر ساخت همزمان) */
export class DuplicateCouponCodeError extends Error {}

export interface AdminCouponsTx {
  /** ردیف را FOR UPDATE قفل می‌کند (ویرایش‌های همزمان یک کوپن پشت‌سرهم) و می‌خواند */
  lockCoupon(id: string): Promise<CouponRecord | null>;
  sellerExists(id: string): Promise<boolean>;
  findProducts(ids: string[]): Promise<{ id: string; sellerId: string }[]>;
  findExistingCategoryIds(ids: string[]): Promise<string[]>;
  create(data: CouponCreateData): Promise<CouponRecord>;
  update(id: string, patch: Partial<CouponEditableData> & { isActive?: boolean }): Promise<CouponRecord>;
  audit(input: AuditInput): Promise<void>;
}

export interface AdminCouponsRepository {
  transaction<T>(work: (tx: AdminCouponsTx) => Promise<T>): Promise<T>;
  list(params: AdminCouponsListParams): Promise<{ items: AdminCouponRow[]; total: number }>;
  findDetail(id: string): Promise<AdminCouponDetailRow | null>;
}

const ROW_SELECT = {
  id: true,
  code: true,
  description: true,
  discountType: true,
  discountValue: true,
  maxDiscountAmount: true,
  minPurchaseAmount: true,
  startsAt: true,
  expiresAt: true,
  isActive: true,
  usageLimit: true,
  perUserLimit: true,
  usedCount: true,
  sellerId: true,
  productIds: true,
  categoryIds: true,
  createdAt: true,
  updatedAt: true,
  seller: { select: { storeName: true } },
} satisfies Prisma.CouponSelect;

type Row = Prisma.CouponGetPayload<{ select: typeof ROW_SELECT }>;

function toRow({ seller, ...rest }: Row): AdminCouponRow {
  return { ...rest, sellerName: seller?.storeName ?? null };
}

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

function createTx(tx: Prisma.TransactionClient): AdminCouponsTx {
  const { seller: _seller, ...recordSelect } = ROW_SELECT;
  void _seller;
  return {
    async lockCoupon(id) {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "coupons" WHERE "id" = ${id} FOR UPDATE`;
      if (locked.length === 0) return null;
      return tx.coupon.findUniqueOrThrow({ where: { id }, select: recordSelect });
    },

    async sellerExists(id) {
      return (await tx.seller.count({ where: { id } })) > 0;
    },

    findProducts(ids) {
      return tx.product.findMany({ where: { id: { in: ids } }, select: { id: true, sellerId: true } });
    },

    async findExistingCategoryIds(ids) {
      const rows = await tx.category.findMany({ where: { id: { in: ids } }, select: { id: true } });
      return rows.map((row) => row.id);
    },

    async create(data) {
      try {
        return await tx.coupon.create({ data, select: recordSelect });
      } catch (error) {
        if (isUniqueViolation(error)) throw new DuplicateCouponCodeError();
        throw error;
      }
    },

    update(id, patch) {
      return tx.coupon.update({ where: { id }, data: patch, select: recordSelect });
    },

    async audit(input) {
      await tx.adminAuditLog.create({ data: toAuditCreateData(input) });
    },
  };
}

export function createAdminCouponsRepository(prisma: PrismaClient): AdminCouponsRepository {
  return {
    transaction(work) {
      return prisma.$transaction((tx) => work(createTx(tx)), { timeout: 15_000, maxWait: 10_000 });
    },

    async list({ page, limit, q, isActive }) {
      const where: Prisma.CouponWhereInput = {
        // q از Service نرمال‌شده می‌آید (حروف بزرگ لاتین)
        ...(q ? { code: { contains: q } } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      };
      const [items, total] = await Promise.all([
        prisma.coupon.findMany({
          where,
          select: ROW_SELECT,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.coupon.count({ where }),
      ]);
      return { items: items.map(toRow), total };
    },

    async findDetail(id) {
      const row = await prisma.coupon.findUnique({ where: { id }, select: ROW_SELECT });
      if (!row) return null;
      const [products, categories, grouped, history] = await Promise.all([
        row.productIds.length
          ? prisma.product.findMany({
              where: { id: { in: row.productIds } },
              select: { id: true, title: true },
              orderBy: { title: "asc" },
            })
          : [],
        row.categoryIds.length
          ? prisma.category.findMany({
              where: { id: { in: row.categoryIds } },
              select: { id: true, name: true },
              orderBy: { name: "asc" },
            })
          : [],
        prisma.couponRedemption.groupBy({
          by: ["status"],
          where: { couponId: id },
          _count: { _all: true },
          _sum: { discountAmount: true },
        }),
        prisma.adminAuditLog.findMany({
          where: { targetType: "COUPON", targetId: id },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: AUDIT_ENTRY_SELECT,
        }),
      ]);
      const active = grouped.find((g) => g.status === "ACTIVE");
      const released = grouped.find((g) => g.status === "RELEASED");
      return {
        ...toRow(row),
        products,
        categories,
        stats: {
          usedCount: row.usedCount,
          releasedCount: released?._count._all ?? 0,
          remaining: row.usageLimit === null ? null : Math.max(0, row.usageLimit - row.usedCount),
          totalDiscountAmount: active?._sum.discountAmount ?? 0,
        },
        history,
      };
    },
  };
}
