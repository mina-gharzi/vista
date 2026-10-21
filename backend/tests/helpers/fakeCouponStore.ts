import { randomUUID } from "node:crypto";
import type { AuditInput } from "../../src/modules/admin/admin.audit";
import {
  DuplicateCouponCodeError,
  type AdminCouponDetailRow,
  type AdminCouponRow,
  type AdminCouponsRepository,
  type AdminCouponsTx,
  type CouponRecord,
} from "../../src/modules/coupons/adminCoupons.repository";
import type { CouponRules } from "../../src/modules/coupons/coupons.engine";

/** جداول «مرجع» که کوپن به آن‌ها اشاره می‌کند (فروشنده/محصول/دسته) */
export interface CouponLookups {
  sellers: Map<string, string>;
  products: Map<string, { sellerId: string; title: string }>;
  categories: Map<string, { name: string; parentId: string | null }>;
}

export const createLookups = (): CouponLookups => ({
  sellers: new Map(),
  products: new Map(),
  categories: new Map(),
});

export interface StoredRedemption {
  id: string;
  couponId: string;
  userId: string;
  orderId: string;
  discountAmount: number;
  status: "ACTIVE" | "RELEASED";
  releasedAt: Date | null;
}

export interface FakeAudit extends AuditInput {
  at: Date;
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

/**
 * ذخیرهٔ درون‌حافظه‌ای کوپن‌ها و استفاده‌ها با همان معناشناسی دیتابیس واقعی:
 *  - مصرف اتمیک و شرطی (isActive و usedCount < usageLimit) مثل UPDATE … WHERE
 *  - ایندکس یکتای کد و یکتای orderId روی استفاده‌ها
 *  - همهٔ تغییرات «Undo» می‌گیرند تا Rollback تراکنش واقعی شبیه‌سازی شود.
 */
export function createFakeCouponStore(lookups: CouponLookups = createLookups()) {
  const coupons = new Map<string, CouponRecord>();
  const redemptions: StoredRedemption[] = [];
  const audits: FakeAudit[] = [];
  const history = { clock: 1_790_000_000_000 };

  const seed = (input: Partial<CouponRecord> & { code: string }): CouponRecord => {
    const stamp = new Date(history.clock);
    const record: CouponRecord = {
      id: randomUUID(),
      description: null,
      discountType: "FIXED",
      discountValue: 100_000,
      maxDiscountAmount: null,
      minPurchaseAmount: null,
      startsAt: null,
      expiresAt: null,
      isActive: true,
      usageLimit: null,
      perUserLimit: null,
      usedCount: 0,
      sellerId: null,
      productIds: [],
      categoryIds: [],
      createdAt: stamp,
      updatedAt: stamp,
      ...input,
    };
    coupons.set(record.id, record);
    return record;
  };

  const toRules = (record: CouponRecord): CouponRules => ({
    id: record.id,
    code: record.code,
    description: record.description,
    discountType: record.discountType,
    discountValue: record.discountValue,
    maxDiscountAmount: record.maxDiscountAmount,
    minPurchaseAmount: record.minPurchaseAmount,
    startsAt: record.startsAt,
    expiresAt: record.expiresAt,
    isActive: record.isActive,
    usageLimit: record.usageLimit,
    perUserLimit: record.perUserLimit,
    usedCount: record.usedCount,
    sellerId: record.sellerId,
    productIds: [...record.productIds],
    categoryIds: [...record.categoryIds],
  });

  return {
    coupons,
    redemptions,
    audits,
    lookups,
    seed,
    byCode: (code: string) => [...coupons.values()].find((c) => c.code === code),
    get: (id: string) => coupons.get(id)!,
    activeRedemptions: (couponId: string) =>
      redemptions.filter((r) => r.couponId === couponId && r.status === "ACTIVE"),

    // ───── خواندن‌ها (مشترک بین Checkout و پیش‌نمایش) ─────
    findRulesByCode(code: string): CouponRules | null {
      const record = [...coupons.values()].find((c) => c.code === code);
      return record ? toRules(record) : null;
    },
    countActive(couponId: string, userId: string): number {
      return redemptions.filter(
        (r) => r.couponId === couponId && r.userId === userId && r.status === "ACTIVE",
      ).length;
    },
    categoryParents(): Map<string, string | null> {
      return new Map([...lookups.categories].map(([id, c]) => [id, c.parentId]));
    },

    // ───── نوشتن‌های اتمیک با Undo ─────
    tryConsume(couponId: string, undo: (() => void)[]): boolean {
      const record = coupons.get(couponId);
      if (!record || !record.isActive) return false;
      if (record.usageLimit !== null && record.usedCount >= record.usageLimit) return false;
      record.usedCount += 1;
      undo.push(() => {
        record.usedCount -= 1;
      });
      return true;
    },
    createRedemption(
      input: Omit<StoredRedemption, "id" | "status" | "releasedAt">,
      undo: (() => void)[],
    ): void {
      // مثل ایندکس یکتای orderId
      if (redemptions.some((r) => r.orderId === input.orderId)) {
        throw new Error("duplicate redemption for order");
      }
      const row: StoredRedemption = { id: randomUUID(), status: "ACTIVE", releasedAt: null, ...input };
      redemptions.push(row);
      undo.push(() => {
        redemptions.splice(redemptions.indexOf(row), 1);
      });
    },
    release(orderId: string, undo: (() => void)[]): boolean {
      const row = redemptions.find((r) => r.orderId === orderId && r.status === "ACTIVE");
      if (!row) return false;
      row.status = "RELEASED";
      row.releasedAt = new Date(history.clock);
      const record = coupons.get(row.couponId)!;
      const before = record.usedCount;
      record.usedCount = Math.max(0, record.usedCount - 1);
      undo.push(() => {
        row.status = "ACTIVE";
        row.releasedAt = null;
        record.usedCount = before;
      });
      return true;
    },

    // ───── Repository ادمین ─────
    adminRepository(): AdminCouponsRepository {
      const toRow = (record: CouponRecord): AdminCouponRow => ({
        ...record,
        productIds: [...record.productIds],
        categoryIds: [...record.categoryIds],
        sellerName: record.sellerId ? (lookups.sellers.get(record.sellerId) ?? null) : null,
      });

      const buildTx = (undo: (() => void)[]): AdminCouponsTx => ({
        async lockCoupon(id) {
          await tick();
          const record = coupons.get(id);
          return record ? { ...record } : null;
        },
        async sellerExists(id) {
          await tick();
          return lookups.sellers.has(id);
        },
        async findProducts(ids) {
          await tick();
          return ids.flatMap((id) => {
            const p = lookups.products.get(id);
            return p ? [{ id, sellerId: p.sellerId }] : [];
          });
        },
        async findExistingCategoryIds(ids) {
          await tick();
          return ids.filter((id) => lookups.categories.has(id));
        },
        async create(data) {
          await tick();
          if ([...coupons.values()].some((c) => c.code === data.code)) {
            throw new DuplicateCouponCodeError();
          }
          history.clock += 1000;
          const stamp = new Date(history.clock);
          const record: CouponRecord = { id: randomUUID(), usedCount: 0, createdAt: stamp, updatedAt: stamp, ...data };
          coupons.set(record.id, record);
          undo.push(() => {
            coupons.delete(record.id);
          });
          return { ...record };
        },
        async update(id, patch) {
          await tick();
          const record = coupons.get(id)!;
          const before = { ...record };
          Object.assign(record, patch, { updatedAt: new Date((history.clock += 1000)) });
          undo.push(() => {
            Object.assign(record, before);
          });
          return { ...record };
        },
        async audit(input) {
          await tick();
          const entry: FakeAudit = { ...input, at: new Date((history.clock += 1000)) };
          audits.push(entry);
          undo.push(() => {
            audits.splice(audits.indexOf(entry), 1);
          });
        },
      });

      return {
        async transaction(work) {
          const undo: (() => void)[] = [];
          try {
            return await work(buildTx(undo));
          } catch (error) {
            for (const step of undo.reverse()) step();
            throw error;
          }
        },

        async list({ page, limit, q, isActive }) {
          await tick();
          const needle = q?.toUpperCase();
          const all = [...coupons.values()]
            .filter((c) => (needle ? c.code.includes(needle) : true))
            .filter((c) => (isActive === undefined ? true : c.isActive === isActive))
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
          return { items: all.slice((page - 1) * limit, page * limit).map(toRow), total: all.length };
        },

        async findDetail(id): Promise<AdminCouponDetailRow | null> {
          await tick();
          const record = coupons.get(id);
          if (!record) return null;
          const mine = redemptions.filter((r) => r.couponId === id);
          const active = mine.filter((r) => r.status === "ACTIVE");
          return {
            ...toRow(record),
            products: record.productIds.flatMap((pid) => {
              const p = lookups.products.get(pid);
              return p ? [{ id: pid, title: p.title }] : [];
            }),
            categories: record.categoryIds.flatMap((cid) => {
              const c = lookups.categories.get(cid);
              return c ? [{ id: cid, name: c.name }] : [];
            }),
            stats: {
              usedCount: record.usedCount,
              releasedCount: mine.filter((r) => r.status === "RELEASED").length,
              remaining:
                record.usageLimit === null ? null : Math.max(0, record.usageLimit - record.usedCount),
              totalDiscountAmount: active.reduce((sum, r) => sum + r.discountAmount, 0),
            },
            history: audits
              .filter((a) => a.targetType === "COUPON" && a.targetId === id)
              .sort((a, b) => b.at.getTime() - a.at.getTime())
              .map((a, index) => ({
                id: `audit-${index}`,
                action: a.action,
                fromStatus: a.fromStatus ?? null,
                toStatus: a.toStatus ?? null,
                reason: a.reason ?? null,
                createdAt: a.at,
                actor: { fullName: "مدیر" },
              })),
          };
        },
      };
    },
  };
}

export type FakeCouponStore = ReturnType<typeof createFakeCouponStore>;
