import {
  checkCouponRules,
  deriveCouponState,
  normalizeCouponCode,
  type AdminCouponDetail,
  type AdminCouponList,
  type AdminCouponListItem,
  type AdminCouponsQuery,
  type CouponStatusInput,
  type CreateCouponInput,
  type UpdateCouponInput,
} from "@vista/shared";
import { ConflictError, NotFoundError, ValidationError } from "../../errors/AppError";
import { toAuditEntry } from "../admin/admin.audit";
import {
  DuplicateCouponCodeError,
  type AdminCouponDetailRow,
  type AdminCouponRow,
  type AdminCouponsRepository,
  type AdminCouponsTx,
  type CouponEditableData,
  type CouponRecord,
} from "./adminCoupons.repository";

export interface AdminCouponsService {
  list(query: AdminCouponsQuery): Promise<AdminCouponList>;
  getDetail(id: string): Promise<AdminCouponDetail>;
  create(adminId: string, input: CreateCouponInput): Promise<AdminCouponDetail>;
  update(adminId: string, id: string, input: UpdateCouponInput): Promise<AdminCouponDetail>;
  setStatus(adminId: string, id: string, input: CouponStatusInput): Promise<AdminCouponDetail>;
}

export interface AdminCouponsServiceOptions {
  now?: () => Date;
}

const CODE_TAKEN = "این کد کوپن قبلاً ثبت شده است";
const NOT_FOUND = "کوپن یافت نشد";

const iso = (date: Date | null): string | null => (date ? date.toISOString() : null);

function validationFailure(errors: Record<string, string>): ValidationError {
  return new ValidationError(
    "داده‌های کوپن معتبر نیستند",
    Object.fromEntries(Object.entries(errors).map(([field, message]) => [field, [message]])),
  );
}

/** کپی دفاعی: آرایه‌ها بدون تکرار و مرتب (نتیجهٔ Deterministic و بدون ردیف تکراری) */
const uniqueSorted = (ids: readonly string[]): string[] => [...new Set(ids)].sort();

export function createAdminCouponsService(
  repository: AdminCouponsRepository,
  options: AdminCouponsServiceOptions = {},
): AdminCouponsService {
  const now = options.now ?? (() => new Date());

  const toListItem = (row: AdminCouponRow): AdminCouponListItem => ({
    id: row.id,
    code: row.code,
    description: row.description,
    discountType: row.discountType,
    discountValue: row.discountValue,
    maxDiscountAmount: row.maxDiscountAmount,
    minPurchaseAmount: row.minPurchaseAmount,
    startsAt: iso(row.startsAt),
    expiresAt: iso(row.expiresAt),
    isActive: row.isActive,
    state: deriveCouponState(row, now()),
    usageLimit: row.usageLimit,
    perUserLimit: row.perUserLimit,
    usedCount: row.usedCount,
    sellerId: row.sellerId,
    sellerName: row.sellerName,
    productCount: row.productIds.length,
    categoryCount: row.categoryIds.length,
    createdAt: row.createdAt.toISOString(),
  });

  const toDetail = (row: AdminCouponDetailRow): AdminCouponDetail => ({
    ...toListItem(row),
    updatedAt: row.updatedAt.toISOString(),
    products: row.products,
    categories: row.categories,
    stats: row.stats,
    history: row.history.map(toAuditEntry),
  });

  const requireDetail = async (id: string): Promise<AdminCouponDetail> => {
    const row = await repository.findDetail(id);
    if (!row) throw new NotFoundError(NOT_FOUND);
    return toDetail(row);
  };

  /**
   * محدودیت‌ها از «روابط قابل‌اعتماد دیتابیس» سنجیده می‌شوند: فروشنده/محصول/دسته باید وجود داشته باشند و
   * اگر هم فروشنده و هم محصول تعیین شده، هر محصول باید متعلق به همان فروشنده باشد (وگرنه کوپن هرگز اعمال نمی‌شد).
   */
  async function verifyRestrictions(
    tx: AdminCouponsTx,
    sellerId: string | null,
    productIds: string[],
    categoryIds: string[],
  ): Promise<void> {
    const errors: Record<string, string> = {};
    if (sellerId !== null && !(await tx.sellerExists(sellerId))) {
      errors.sellerId = "فروشنده یافت نشد";
    }
    if (productIds.length > 0) {
      const found = await tx.findProducts(productIds);
      if (found.length !== productIds.length) {
        errors.productIds = "برخی محصول‌ها یافت نشدند";
      } else if (sellerId !== null && found.some((p) => p.sellerId !== sellerId)) {
        errors.productIds = "همهٔ محصول‌ها باید متعلق به فروشندهٔ انتخاب‌شده باشند";
      }
    }
    if (categoryIds.length > 0) {
      const found = await tx.findExistingCategoryIds(categoryIds);
      if (found.length !== categoryIds.length) errors.categoryIds = "برخی دسته‌بندی‌ها یافت نشدند";
    }
    if (Object.keys(errors).length > 0) throw validationFailure(errors);
  }

  return {
    async list(query) {
      // جستجو روی «کد نرمال‌شده» (حروف بزرگ/ارقام لاتین) — نرمال‌سازی در Service تا هر Repository یکسان رفتار کند
      const { items, total } = await repository.list({
        ...query,
        q: query.q ? normalizeCouponCode(query.q) : undefined,
      });
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

    getDetail: requireDetail,

    async create(adminId, input) {
      const productIds = uniqueSorted(input.productIds ?? []);
      const categoryIds = uniqueSorted(input.categoryIds ?? []);
      const sellerId = input.sellerId ?? null;
      try {
        const id = await repository.transaction(async (tx) => {
          await verifyRestrictions(tx, sellerId, productIds, categoryIds);
          const created = await tx.create({
            code: input.code,
            isActive: input.isActive ?? true,
            description: input.description ?? null,
            discountType: input.discountType,
            discountValue: input.discountValue,
            maxDiscountAmount: input.maxDiscountAmount ?? null,
            minPurchaseAmount: input.minPurchaseAmount ?? null,
            startsAt: input.startsAt ? new Date(input.startsAt) : null,
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
            usageLimit: input.usageLimit ?? null,
            perUserLimit: input.perUserLimit ?? null,
            sellerId,
            productIds,
            categoryIds,
          });
          await tx.audit({
            adminId,
            action: "COUPON_CREATED",
            targetType: "COUPON",
            targetId: created.id,
            toStatus: created.isActive ? "ACTIVE" : "INACTIVE",
            details: { code: created.code, discountType: created.discountType },
          });
          return created.id;
        });
        return await requireDetail(id);
      } catch (error) {
        if (error instanceof DuplicateCouponCodeError) {
          throw new ConflictError(CODE_TAKEN, { code: [CODE_TAKEN] });
        }
        throw error;
      }
    },

    async update(adminId, id, input) {
      await repository.transaction(async (tx) => {
        const current = await tx.lockCoupon(id);
        if (!current) throw new NotFoundError(NOT_FOUND);

        const pick = <K extends keyof CouponEditableData>(key: K): CouponEditableData[K] => {
          const patched = input[key as keyof UpdateCouponInput] as CouponEditableData[K] | undefined;
          return patched !== undefined ? patched : (current[key] as CouponEditableData[K]);
        };
        const merged: CouponEditableData = {
          description: pick("description"),
          discountType: pick("discountType"),
          discountValue: pick("discountValue"),
          maxDiscountAmount: pick("maxDiscountAmount"),
          minPurchaseAmount: pick("minPurchaseAmount"),
          startsAt:
            input.startsAt !== undefined ? (input.startsAt ? new Date(input.startsAt) : null) : current.startsAt,
          expiresAt:
            input.expiresAt !== undefined ? (input.expiresAt ? new Date(input.expiresAt) : null) : current.expiresAt,
          usageLimit: pick("usageLimit"),
          perUserLimit: pick("perUserLimit"),
          sellerId: pick("sellerId"),
          productIds: input.productIds !== undefined ? uniqueSorted(input.productIds) : current.productIds,
          categoryIds: input.categoryIds !== undefined ? uniqueSorted(input.categoryIds) : current.categoryIds,
        };

        // یک قانون واحد (shared) روی «حالت ادغام‌شده»: مثلاً تغییر نوع به ثابت با سقف تخفیف قبلی رد می‌شود
        const ruleErrors = checkCouponRules(merged);
        if (Object.keys(ruleErrors).length > 0) throw validationFailure(ruleErrors);

        if (merged.usageLimit !== null && merged.usageLimit < current.usedCount) {
          const message = `سقف کل نمی‌تواند کمتر از تعداد استفاده‌های ثبت‌شده (${current.usedCount}) باشد`;
          throw new ConflictError(message, { usageLimit: [message] });
        }

        const restrictionsTouched =
          input.sellerId !== undefined || input.productIds !== undefined || input.categoryIds !== undefined;
        if (restrictionsTouched) {
          await verifyRestrictions(tx, merged.sellerId, merged.productIds, merged.categoryIds);
        }

        await tx.update(id, merged);
        await tx.audit({
          adminId,
          action: "COUPON_UPDATED",
          targetType: "COUPON",
          targetId: id,
          // فقط «نام فیلدهای تغییرکرده»؛ مقادیر در Snapshot سفارش‌ها محفوظ است
          details: { fields: Object.keys(input).sort() },
        });
      });
      return requireDetail(id);
    },

    async setStatus(adminId, id, { isActive }) {
      await repository.transaction(async (tx) => {
        const current = await tx.lockCoupon(id);
        if (!current) throw new NotFoundError(NOT_FOUND);
        // تکرار همان وضعیت = بدون تغییر و بدون ردیف ممیزی اضافه (Idempotent)
        if (current.isActive === isActive) return;
        await tx.update(id, { isActive });
        await tx.audit({
          adminId,
          action: "COUPON_STATUS_CHANGED",
          targetType: "COUPON",
          targetId: id,
          fromStatus: current.isActive ? "ACTIVE" : "INACTIVE",
          toStatus: isActive ? "ACTIVE" : "INACTIVE",
        });
      });
      return requireDetail(id);
    },
  };
}

export type { CouponRecord };
