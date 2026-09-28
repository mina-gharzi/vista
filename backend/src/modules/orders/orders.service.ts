import type { OrderDetail, OrderListItem, PaginatedResponse } from "@vista/shared";
import { ConflictError, NotFoundError } from "../../errors/AppError";
import type { PaymentProvider } from "../../payment/PaymentProvider";
import { AddressNotOwnedError, EmptyCartError, ItemsUnavailableError } from "./orders.repository";
import type { OrdersRepository } from "./orders.repository";
import { toOrderDetail, toOrderListItem } from "./orders.mapper";

const REASON_MESSAGE: Record<"NOT_PUBLISHED" | "INSUFFICIENT_STOCK", string> = {
  NOT_PUBLISHED: "دیگر در دسترس نیست",
  INSUFFICIENT_STOCK: "موجودی کافی ندارد",
};

export interface OrdersService {
  checkout(userId: string, addressId: string): Promise<OrderDetail>;
  list(
    userId: string,
    params: { page: number; limit: number },
  ): Promise<PaginatedResponse<OrderListItem>>;
  getDetail(userId: string, orderId: string): Promise<OrderDetail>;
}

export function createOrdersService(
  repository: OrdersRepository,
  paymentProvider: PaymentProvider,
): OrdersService {
  return {
    async checkout(userId, addressId) {
      let order;
      try {
        order = await repository.createOrderFromCart(userId, addressId);
      } catch (error) {
        if (error instanceof AddressNotOwnedError) {
          throw new NotFoundError("آدرس یافت نشد");
        }
        if (error instanceof EmptyCartError) {
          throw new ConflictError("سبد خرید شما خالی است");
        }
        if (error instanceof ItemsUnavailableError) {
          const summary = error.items
            .map((item) => `${item.productTitle} (${REASON_MESSAGE[item.reason]})`)
            .join("، ");
          throw new ConflictError(`برخی کالاهای سبد خرید در دسترس نیستند: ${summary}`, {
            variantIds: error.items.map((item) => item.variantId),
          });
        }
        throw error;
      }

      // پرداخت: فعلاً فقط MockPaymentProvider (همیشه موفق) — یکپارچه‌سازی درگاه واقعی در Feature «Payment» (Phase 4)
      const session = await paymentProvider.createPaymentSession({
        orderId: order.id,
        amount: order.totalAmount,
        callbackUrl: "internal://mock-checkout",
      });
      const verification = await paymentProvider.verifyPayment(session.providerRef, {});
      if (verification.success) {
        order = await repository.markPaid(order.id, session.providerRef);
      }
      // اگر پرداخت ناموفق بود (فقط با یک Provider واقعی ممکن است)، سفارش با وضعیت PENDING باقی می‌ماند
      // و در همان لحظه به کاربر برگردانده می‌شود — تلاش مجدد پرداخت، Scope همین Feature «Payment» است.

      return toOrderDetail(order);
    },

    async list(userId, params) {
      const { items, total } = await repository.findManyForUser(userId, params);
      return {
        data: items.map(toOrderListItem),
        pagination: {
          page: params.page,
          limit: params.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / params.limit)),
        },
      };
    },

    async getDetail(userId, orderId) {
      const order = await repository.findOwnedById(userId, orderId);
      if (!order) {
        throw new NotFoundError("سفارش یافت نشد");
      }
      return toOrderDetail(order);
    },
  };
}
