import {
  deriveOrderFulfillment,
  type AdminOrderDetail,
  type AdminOrderList,
  type AdminOrdersQuery,
  type FulfillmentStatus,
  type OrderStatus,
} from "@vista/shared";
import { NotFoundError } from "../../errors/AppError";
import type { AdminOrdersRepository } from "./adminOrders.repository";

/**
 * سفارش‌ها برای ادمین «فقط‌خواندنی» است. تغییر وضعیت پرداخت ممنوع است (هیچ مسیر «علامت‌گذاری پرداخت»
 * بدون تأیید واقعی درگاه وجود ندارد)، ارسال/تحویل فقط با فروشنده و لغو/بازگشت وجه به Feature پرداخت
 * سپرده شده است؛ پس هیچ Endpoint نوشتنی برای سفارش ساخته نشده تا Invariantهای موجودی/فروشنده نشکند.
 */
export interface AdminOrdersService {
  list(query: AdminOrdersQuery): Promise<AdminOrderList>;
  getDetail(orderId: string): Promise<AdminOrderDetail>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createAdminOrdersService(repository: AdminOrdersRepository): AdminOrdersService {
  return {
    async list(query) {
      const term = query.q?.replace(/^#/, "").trim();
      const isNumber = term !== undefined && /^\d{1,9}$/.test(term);
      const isId = term !== undefined && UUID_RE.test(term);

      // عبارت جستجوی نامعتبر (نه شماره، نه شناسه) = «نتیجه‌ای نیست»، نه «همهٔ سفارش‌ها»
      if (term && !isNumber && !isId) {
        return {
          data: [],
          pagination: { page: query.page, limit: query.limit, total: 0, totalPages: 1 },
        };
      }

      const { items, total } = await repository.list({
        page: query.page,
        limit: query.limit,
        orderNumber: isNumber ? Number(term) : undefined,
        orderId: isId ? term.toLowerCase() : undefined,
        status: query.status,
        from: query.from,
        to: query.to,
      });
      return {
        data: items.map((row) => ({
          id: row.id,
          orderNumber: row.orderNumber,
          status: row.status as OrderStatus,
          totalAmount: row.totalAmount,
          customerName: row.customerName,
          sellerCount: row.sellerOrders.length,
          fulfillment: deriveOrderFulfillment(row.sellerOrders.map((so) => so.status as FulfillmentStatus)),
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

    async getDetail(orderId) {
      const order = await repository.findDetail(orderId);
      if (!order) throw new NotFoundError("سفارش یافت نشد");
      const statuses = order.sellerOrders.map((so) => so.status as FulfillmentStatus);
      const iso = (date: Date | null) => (date ? date.toISOString() : null);
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status as OrderStatus,
        subtotal: order.subtotal,
        shippingCost: order.shippingCost,
        discountAmount: order.discountAmount,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt.toISOString(),
        paidAt: iso(order.paidAt),
        cancelledAt: iso(order.cancelledAt),
        customer: order.customer,
        shippingAddress: order.shipping,
        fulfillment: deriveOrderFulfillment(statuses),
        sellerOrders: order.sellerOrders.map((so) => ({
          id: so.id,
          sellerId: so.sellerId,
          sellerName: so.sellerName,
          status: so.status as FulfillmentStatus,
          subtotal: so.subtotal,
          trackingCode: so.trackingCode,
          shippedAt: iso(so.shippedAt),
          deliveredAt: iso(so.deliveredAt),
          items: so.items.map((item) => ({ ...item, lineTotal: item.unitPrice * item.quantity })),
          history: so.events.map((event) => ({
            id: event.id,
            fromStatus: event.fromStatus as FulfillmentStatus,
            toStatus: event.toStatus as FulfillmentStatus,
            trackingCode: event.trackingCode,
            createdAt: event.createdAt.toISOString(),
          })),
        })),
      };
    },
  };
}
