import {
  COUPON_ERROR_CODES,
  isOrderCancellableByCustomer,
  isValidCouponCode,
  normalizeCouponCode,
  type CheckoutInput,
  type FulfillmentStatus,
  type OrderDetail,
  type OrderListItem,
  type OrderStatus,
  type OrdersQuery,
  type PaginatedResponse,
} from "@vista/shared";
import { NotFoundError } from "../../errors/AppError";
import type { PaymentProvider } from "../../payment/PaymentProvider";
import { evaluateCoupon, type CouponEvaluation } from "../coupons/coupons.engine";
import { CouponRuleError, couponInvalid } from "../coupons/coupons.errors";
import {
  CheckoutEmptyCartError,
  CheckoutItemsUnavailableError,
  CheckoutPriceChangedError,
  OrderNotCancellableError,
  type UnavailableLine,
} from "./orders.errors";
import { toOrderDetail, toOrderListItem } from "./orders.mapper";
import { computeCharges, toPricedLines, unitPriceOf } from "./orders.pricing";
import {
  DuplicateCheckoutKeyError,
  type CartLine,
  type MovementRow,
  type NewOrderData,
  type OrderWithRelations,
  type OrdersRepository,
  type OrdersTx,
} from "./orders.repository";

export interface CheckoutResult {
  order: OrderDetail;
  /** false = تلاش تکراری با همان checkoutKey؛ همان سفارش قبلی برگردانده شده و چیزی دوباره کسر نشده */
  created: boolean;
}

export interface OrdersService {
  checkout(userId: string, input: CheckoutInput): Promise<CheckoutResult>;
  list(userId: string, params: OrdersQuery): Promise<PaginatedResponse<OrderListItem>>;
  getDetail(userId: string, orderId: string): Promise<OrderDetail>;
  cancel(userId: string, orderId: string): Promise<OrderDetail>;
}

/** فقط کالاهای «قابل خرید»: محصول منتشرشده + تنوع فعال + فروشنده تأییدشده + موجودی کافی */
function findProblems(lines: CartLine[]): UnavailableLine[] {
  const problems: UnavailableLine[] = [];
  for (const line of lines) {
    if (
      line.productStatus !== "PUBLISHED" ||
      !line.variantActive ||
      line.sellerStatus !== "APPROVED"
    ) {
      problems.push({
        variantId: line.variantId,
        productTitle: line.productTitle,
        reason: "UNAVAILABLE",
        availableStock: 0,
      });
    } else if (line.stock < line.quantity) {
      problems.push({
        variantId: line.variantId,
        productTitle: line.productTitle,
        reason: "INSUFFICIENT_STOCK",
        availableStock: Math.max(0, line.stock),
      });
    }
  }
  return problems;
}

/**
 * paymentProvider = null یعنی درگاهی برای تأیید خودکار وجود ندارد و سفارش در وضعیت PENDING می‌ماند.
 * ⚠️ فقط MockPaymentProvider (توسعه/دمو، در index.ts و فقط خارج از Production) تأیید خودکار انجام می‌دهد؛
 * این «تأیید پرداخت واقعی» نیست. تأیید درگاه واقعی/Webhook در Feature «Payment» است.
 */
export interface OrdersServiceOptions {
  /** ساعت تزریق‌پذیر (فقط برای تست انقضا/شروع کوپن) */
  now?: () => Date;
}

/** کوپن «اعمال‌شده» داخل Transaction: شناسه + Snapshot کد + نتیجهٔ محاسبه */
interface AppliedCoupon {
  couponId: string;
  code: string;
  evaluation: CouponEvaluation;
}

export function createOrdersService(
  repository: OrdersRepository,
  paymentProvider: PaymentProvider | null,
  options: OrdersServiceOptions = {},
): OrdersService {
  const now = options.now ?? (() => new Date());

  /**
   * اعتبارسنجی «و مصرف» کوپن، فقط داخل Transaction ثبت سفارش و بعد از قفل کاربر:
   *  - مشمولیت/قیمت‌ها فقط از دیتابیس (سبد + کوپن + جدول دسته‌ها).
   *  - سقف هر مشتری: چون Checkoutهای یک کاربر با lockUser پشت‌سرهم‌اند، شمارش امن است.
   *  - سقف کل: tryConsumeCoupon یک UPDATE شرطی اتمیک است (Race روی آخرین ظرفیت امن).
   * هر شکستی بعد از این نقطه، کل Transaction (از جمله مصرف کوپن) را برمی‌گرداند.
   */
  async function applyCoupon(
    tx: OrdersTx,
    userId: string,
    rawCode: string,
    lines: readonly CartLine[],
  ): Promise<AppliedCoupon> {
    const normalized = normalizeCouponCode(rawCode);
    if (!isValidCouponCode(normalized)) throw couponInvalid();
    const coupon = await tx.findCouponByCode(normalized);
    if (!coupon) throw couponInvalid();

    const parents = await tx.loadCategoryParents();
    const userRedemptions =
      coupon.perUserLimit === null ? 0 : await tx.countActiveRedemptions(coupon.id, userId);
    const evaluation = evaluateCoupon({
      coupon,
      lines: toPricedLines(lines, parents),
      userRedemptions,
      now: now(),
    });

    if (!(await tx.tryConsumeCoupon(coupon.id))) {
      // بین خواندن و مصرف، ظرفیت تمام شده یا ادمین کوپن را غیرفعال کرده است
      throw new CouponRuleError(COUPON_ERROR_CODES.USAGE_LIMIT_REACHED);
    }
    return { couponId: coupon.id, code: coupon.code, evaluation };
  }

  async function settleDevPayment(order: OrderWithRelations): Promise<OrderWithRelations> {
    if (!paymentProvider || order.status !== "PENDING") return order;
    const session = await paymentProvider.createPaymentSession({
      orderId: order.id,
      amount: order.totalAmount,
      callbackUrl: "internal://mock-checkout",
    });
    const verification = await paymentProvider.verifyPayment(session.providerRef, {});
    if (!verification.success) return order;
    // Compare-and-Set: اگر همزمان لغو شده باشد، PAID نمی‌شود
    await repository.markPaid(order.id, session.providerRef);
    return (await repository.findById(order.id)) ?? order;
  }

  return {
    async checkout(userId, input) {
      let outcome: { order: OrderWithRelations; created: boolean };
      try {
        outcome = await repository.transaction(async (tx) => {
          // همهٔ تلاش‌های یک کاربر پشت سر هم اجرا می‌شوند؛ تلاش تکراری بعد از Commit اولی
          // دقیقاً همین سفارش را پیدا می‌کند (نه خطای «سبد خالی» یا «موجودی ناکافی»).
          await tx.lockUser(userId);

          const existing = await tx.findByCheckoutKey(userId, input.checkoutKey);
          if (existing) return { order: existing, created: false };

          const address = await tx.findAddress(userId, input.addressId);
          if (!address) throw new NotFoundError("آدرس یافت نشد");

          const lines = await tx.loadCartLines(userId);
          if (lines.length === 0) throw new CheckoutEmptyCartError();

          const problems = findProblems(lines);
          if (problems.length > 0) throw new CheckoutItemsUnavailableError(problems);

          // قیمت‌ها فقط از دیتابیس؛ هیچ مبلغی از Client پذیرفته نمی‌شود
          const subtotal = lines.reduce((sum, line) => sum + unitPriceOf(line) * line.quantity, 0);

          // کوپن (اختیاری): مبلغ تخفیف «فقط» از موتور سمت سرور می‌آید؛ از Client فقط خودِ کد پذیرفته می‌شود
          const applied = input.couponCode
            ? await applyCoupon(tx, userId, input.couponCode, lines)
            : null;
          const charges = computeCharges(subtotal, applied?.evaluation.discountAmount ?? 0);
          if (input.expectedTotal !== undefined && input.expectedTotal !== charges.totalAmount) {
            throw new CheckoutPriceChangedError(input.expectedTotal, charges.totalAmount);
          }

          // کسر موجودی به ترتیب ثابت variantId (جلوگیری از Deadlock بین Checkoutهای همزمان)
          const sorted = [...lines].sort((a, b) => a.variantId.localeCompare(b.variantId));
          const movements: Omit<MovementRow, "orderId">[] = [];
          for (const line of sorted) {
            const stockAfter = await tx.decrementStock(line.variantId, line.quantity);
            if (stockAfter === null) {
              // بین خواندن و کسر، خریدار دیگری موجودی را برده است؛ کل Transaction برمی‌گردد
              throw new CheckoutItemsUnavailableError([
                {
                  variantId: line.variantId,
                  productTitle: line.productTitle,
                  reason: "INSUFFICIENT_STOCK",
                  availableStock: 0,
                },
              ]);
            }
            movements.push({
              variantId: line.variantId,
              type: "ORDER_PLACED",
              quantityDelta: -line.quantity,
              stockAfter,
              actorId: userId,
            });
          }

          const bySeller = new Map<string, CartLine[]>();
          for (const line of sorted) {
            bySeller.set(line.sellerId, [...(bySeller.get(line.sellerId) ?? []), line]);
          }
          const data: NewOrderData = {
            userId,
            checkoutKey: input.checkoutKey,
            subtotal,
            ...charges,
            couponId: applied?.couponId ?? null,
            couponCode: applied?.code ?? null,
            address: {
              fullName: address.fullName,
              phone: address.phone,
              province: address.province,
              city: address.city,
              postalCode: address.postalCode,
              addressLine: address.addressLine,
            },
            sellerOrders: [...bySeller.entries()].map(([sellerId, sellerLines]) => ({
              sellerId,
              subtotal: sellerLines.reduce((sum, l) => sum + unitPriceOf(l) * l.quantity, 0),
              discountAmount: applied?.evaluation.sellerDiscounts.get(sellerId) ?? 0,
              items: sellerLines.map((l) => ({
                variantId: l.variantId,
                quantity: l.quantity,
                unitPrice: unitPriceOf(l),
                discountAmount: applied?.evaluation.lineDiscounts.get(l.variantId) ?? 0,
                productTitle: l.productTitle,
                sku: l.sku,
                size: l.size,
                color: l.color,
                imageUrl: l.imageUrl,
              })),
            })),
          };

          const order = await tx.createOrder(data);
          if (applied) {
            // orderId یکتاست: حتی در بدترین حالت، یک سفارش هرگز دو بار مصرف ثبت نمی‌کند
            await tx.createRedemption({
              couponId: applied.couponId,
              userId,
              orderId: order.id,
              discountAmount: charges.discountAmount,
            });
          }
          await tx.recordMovements(movements.map((m) => ({ ...m, orderId: order.id })));
          // سبد فقط اینجا، در همان Transaction و بعد از ساخته‌شدن سفارش خالی می‌شود
          await tx.clearCart(userId);
          return { order, created: true };
        });
      } catch (error) {
        if (!(error instanceof DuplicateCheckoutKeyError)) throw error;
        // آخرین خط دفاع: ایندکس یکتای دیتابیس تکرار را رد کرد؛ نتیجهٔ همان تلاش اول را برمی‌گردانیم
        const existing = await repository.findByCheckoutKey(userId, input.checkoutKey);
        if (!existing) throw error;
        outcome = { order: existing, created: false };
      }

      const order = await settleDevPayment(outcome.order);
      return { order: toOrderDetail(order), created: outcome.created };
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
      if (!order) throw new NotFoundError("سفارش یافت نشد");
      return toOrderDetail(order);
    },

    async cancel(userId, orderId) {
      return repository.transaction(async (tx) => {
        await tx.lockUser(userId);
        // سفارش دیگران = «یافت نشد» (وجود آن فاش نمی‌شود)
        const target = await tx.lockOwnedOrder(userId, orderId);
        if (!target) throw new NotFoundError("سفارش یافت نشد");

        const current = async (): Promise<OrderDetail> => {
          const order = await tx.findOwnedById(userId, orderId);
          if (!order) throw new NotFoundError("سفارش یافت نشد");
          return toOrderDetail(order);
        };

        // لغو مجدد = موفقیت بدون هیچ اثر (موجودی دوباره برنمی‌گردد)
        if (target.status === "CANCELLED") return current();

        if (target.status === "PAID") {
          throw new OrderNotCancellableError(
            "این سفارش پرداخت شده و لغو آن از اینجا ممکن نیست. برای بازگشت وجه با پشتیبانی تماس بگیرید.",
          );
        }
        if (!isOrderCancellableByCustomer(
            target.status as OrderStatus,
            target.sellerOrderStatuses as FulfillmentStatus[],
          )) {
          throw new OrderNotCancellableError("این سفارش در وضعیتی است که قابل لغو نیست.");
        }

        // Compare-and-Set؛ اگر همزمان پرداخت شده باشد false برمی‌گردد و هیچ موجودی‌ای برنمی‌گردد
        const changed = await tx.markOrderCancelled(target.id);
        if (!changed) {
          throw new OrderNotCancellableError(
            "وضعیت سفارش همزمان تغییر کرد و دیگر قابل لغو نیست. صفحه را تازه کنید.",
          );
        }
        await tx.cancelPendingSellerOrders(target.id);
        // سفارش پرداخت‌نشده لغو شد → استفادهٔ کوپن آزاد می‌شود (CAS؛ لغو مجدد/موازی دوباره آزاد نمی‌کند)
        await tx.releaseCouponRedemption(target.id);

        // برگرداندن موجودی دقیقاً همان مقداری که ثبت سفارش کسر کرده بود؛ فقط در همین مسیر (یک‌بار)
        const merged = new Map<string, number>();
        for (const item of target.items) {
          merged.set(item.variantId, (merged.get(item.variantId) ?? 0) + item.quantity);
        }
        const movements: MovementRow[] = [];
        for (const variantId of [...merged.keys()].sort()) {
          const quantity = merged.get(variantId) as number;
          const stockAfter = await tx.incrementStock(variantId, quantity);
          movements.push({
            variantId,
            type: "ORDER_CANCELLED",
            quantityDelta: quantity,
            stockAfter,
            actorId: userId,
            orderId: target.id,
          });
        }
        await tx.recordMovements(movements);
        return current();
      });
    },
  };
}
