import {
  SELLER_ADMIN_TRANSITIONS,
  SELLER_STATUS_LABEL,
  type AdminSellerDetail,
  type AdminSellerList,
  type AdminSellerStatusInput,
  type AdminSellersQuery,
  type SellerAdminTarget,
} from "@vista/shared";
import { ConflictError, NotFoundError } from "../../errors/AppError";
import { toAuditEntry } from "./admin.audit";
import type { AdminSellersRepository, SellerDetailRow } from "./adminSellers.repository";

export interface AdminSellersService {
  list(query: AdminSellersQuery): Promise<AdminSellerList>;
  getDetail(sellerId: string): Promise<AdminSellerDetail>;
  changeStatus(adminId: string, sellerId: string, input: AdminSellerStatusInput): Promise<AdminSellerDetail>;
}

function toDetail(row: SellerDetailRow): AdminSellerDetail {
  return {
    id: row.id,
    storeName: row.storeName,
    storeSlug: row.storeSlug,
    description: row.description,
    status: row.status,
    statusReason: row.statusReason,
    statusChangedAt: row.statusChangedAt ? row.statusChangedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    owner: {
      name: row.owner.name,
      email: row.owner.email,
      phone: row.owner.phone,
      registeredAt: row.owner.registeredAt.toISOString(),
    },
    products: row.products,
    sellerOrderCount: row.sellerOrderCount,
    allowedTransitions: [...SELLER_ADMIN_TRANSITIONS[row.status]],
    history: row.history.map(toAuditEntry),
  };
}

export function createAdminSellersService(repository: AdminSellersRepository): AdminSellersService {
  async function requireDetail(sellerId: string): Promise<SellerDetailRow> {
    const row = await repository.findDetail(sellerId);
    if (!row) throw new NotFoundError("فروشنده یافت نشد");
    return row;
  }

  return {
    async list(query) {
      const { items, total } = await repository.list(query);
      return {
        data: items.map((row) => ({
          id: row.id,
          storeName: row.storeName,
          storeSlug: row.storeSlug,
          status: row.status,
          ownerName: row.ownerName,
          ownerEmail: row.ownerEmail,
          productCount: row.productCount,
          createdAt: row.createdAt.toISOString(),
        })),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
      };
    },

    async getDetail(sellerId) {
      return toDetail(await requireDetail(sellerId));
    },

    async changeStatus(adminId, sellerId, input) {
      const current = await requireDetail(sellerId);
      const target = input.status as SellerAdminTarget;

      if (!SELLER_ADMIN_TRANSITIONS[current.status].includes(target)) {
        throw new ConflictError(
          `تغییر وضعیت از «${SELLER_STATUS_LABEL[current.status]}» به «${SELLER_STATUS_LABEL[target]}» مجاز نیست.`,
        );
      }

      // دلیل فقط برای رد/تعلیق نگه داشته می‌شود؛ تأیید/فعال‌سازی دلیل قبلی را پاک می‌کند
      const reason = target === "APPROVED" ? null : (input.reason ?? null);
      const changed = await repository.changeStatus({
        sellerId,
        from: current.status,
        to: target,
        reason,
        adminId,
      });
      if (!changed) {
        throw new ConflictError("وضعیت این فروشنده همزمان تغییر کرد. صفحه را تازه کنید.");
      }
      return toDetail(await requireDetail(sellerId));
    },
  };
}
