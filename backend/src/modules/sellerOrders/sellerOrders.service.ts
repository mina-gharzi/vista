import {
  FULFILLMENT_STATUS_LABEL,
  SELLER_ORDER_SOURCE_STATUS,
  SELLER_ORDER_TRANSITIONS,
  type FulfillmentStatus,
  type SellerFulfillmentTarget,
  type SellerOrderDetail,
  type SellerOrderList,
  type SellerOrderListItem,
  type SellerOrdersOverview,
  type SellerOrdersQuery,
  type UpdateSellerOrderStatusInput,
} from "@vista/shared";
import { AuthorizationError, ConflictError, NotFoundError } from "../../errors/AppError";
import { tehranDayStart, tehranNextDayStart } from "../../utils/dateRange";
import type {
  SellerOrderDetailRow,
  SellerOrderListRow,
  SellerOrdersRepository,
} from "./sellerOrders.repository";

const NOT_FOUND = "سفارش یافت نشد";
const STATUSES: readonly FulfillmentStatus[] = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

export function toListItem(row: SellerOrderListRow): SellerOrderListItem {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    createdAt: row.createdAt.toISOString(),
    status: row.status,
    subtotal: row.subtotal,
    itemCount: row.items.reduce((sum, item) => sum + item.quantity, 0),
    previewImageUrl: row.items.find((item) => item.imageUrl)?.imageUrl ?? null,
    trackingCode: row.trackingCode,
  };
}

export function toDetail(row: SellerOrderDetailRow): SellerOrderDetail {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    status: row.status,
    subtotal: row.subtotal,
    trackingCode: row.trackingCode,
    shippedAt: row.shippedAt ? row.shippedAt.toISOString() : null,
    deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
    items: row.items.map((item) => ({
      id: item.id,
      productTitle: item.productTitle,
      sku: item.sku,
      size: item.size,
      color: item.color,
      imageUrl: item.imageUrl,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.unitPrice * item.quantity,
    })),
    // برای سفارش لغوشده آدرس دیگر «لازم برای ارسال» نیست
    shipping: row.status === "CANCELLED" ? null : row.shipping,
    allowedTransitions: SELLER_ORDER_TRANSITIONS[row.status] as SellerFulfillmentTarget[],
    history: row.events.map((event) => ({
      id: event.id,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      trackingCode: event.trackingCode,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

async function requireApprovedSeller(repository: SellerOrdersRepository, userId: string): Promise<string> {
  const seller = await repository.findSellerByUserId(userId);
  if (!seller) throw new AuthorizationError("برای مدیریت سفارش‌ها ابتدا باید حساب فروشندگی ایجاد کنید");
  if (seller.status === "SUSPENDED") throw new AuthorizationError("حساب فروشندگی شما مسدود شده است");
  if (seller.status !== "APPROVED") throw new AuthorizationError("حساب فروشندگی شما هنوز تأیید نشده است");
  return seller.id;
}

export interface SellerOrdersService {
  assertCanManage(userId: string): Promise<void>;
  list(userId: string, query: SellerOrdersQuery): Promise<SellerOrderList>;
  overview(userId: string): Promise<SellerOrdersOverview>;
  detail(userId: string, sellerOrderId: string): Promise<SellerOrderDetail>;
  updateStatus(
    userId: string,
    sellerOrderId: string,
    input: UpdateSellerOrderStatusInput,
  ): Promise<SellerOrderDetail>;
}

export function createSellerOrdersService(repository: SellerOrdersRepository): SellerOrdersService {
  return {
    async assertCanManage(userId) {
      await requireApprovedSeller(repository, userId);
    },

    async list(userId, query) {
      const sellerId = await requireApprovedSeller(repository, userId);
      const { items, total } = await repository.list(sellerId, {
        page: query.page,
        limit: query.limit,
        status: query.status,
        from: query.from ? tehranDayStart(query.from) : undefined,
        toExclusive: query.to ? tehranNextDayStart(query.to) : undefined,
        orderNumber: query.q !== undefined ? Number(query.q) : undefined,
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

    async overview(userId) {
      const sellerId = await requireApprovedSeller(repository, userId);
      const rows = await repository.aggregateByStatus(sellerId);
      const byStatus = Object.fromEntries(
        STATUSES.map((status) => [status, { count: 0, total: 0 }]),
      ) as SellerOrdersOverview["byStatus"];
      for (const row of rows) byStatus[row.status] = { count: row.count, total: row.total };
      return { byStatus, totalOrders: rows.reduce((sum, row) => sum + row.count, 0) };
    },

    async detail(userId, sellerOrderId) {
      const sellerId = await requireApprovedSeller(repository, userId);
      const row = await repository.findOwned(sellerId, sellerOrderId);
      // سفارش فروشنده دیگر و سفارش پرداخت‌نشده هر دو 404؛ وجودشان فاش نمی‌شود
      if (!row) throw new NotFoundError(NOT_FOUND);
      return toDetail(row);
    },

    async updateStatus(userId, sellerOrderId, input) {
      const sellerId = await requireApprovedSeller(repository, userId);
      const to = input.status;
      const from = SELLER_ORDER_SOURCE_STATUS[to];

      const updated = await repository.applyTransition(sellerId, sellerOrderId, {
        from,
        to,
        trackingCode: to === "SHIPPED" ? (input.trackingCode ?? null) : null,
        actorId: userId,
      });
      if (updated) return toDetail(updated);

      // تغییری انجام نشد؛ علت را از وضعیت «فعلی» تشخیص می‌دهیم (فقط برای پیام درست، نه برای تصمیم)
      const current = await repository.findOwned(sellerId, sellerOrderId);
      if (!current) throw new NotFoundError(NOT_FOUND);
      if (current.status === to) {
        throw new ConflictError("این تغییر وضعیت قبلاً ثبت شده است؛ صفحه را تازه کنید");
      }
      if (current.status === "CANCELLED") {
        throw new ConflictError("سفارش لغوشده قابل تغییر نیست");
      }
      throw new ConflictError(
        `تغییر وضعیت از «${FULFILLMENT_STATUS_LABEL[current.status]}» به «${FULFILLMENT_STATUS_LABEL[to]}» مجاز نیست`,
      );
    },
  };
}
