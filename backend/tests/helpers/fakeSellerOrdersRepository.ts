import { randomUUID } from "node:crypto";
import type { FulfillmentStatus } from "@vista/shared";
import type {
  SellerOrderDetailRow,
  SellerOrderEventRow,
  SellerOrderItemRow,
  SellerOrdersRepository,
} from "../../src/modules/sellerOrders/sellerOrders.repository";

type OrderStatus = "PENDING" | "PAID" | "CANCELLED" | "REFUNDED";

interface FakeOrder {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  paidAt: Date | null;
  userId: string;
  customerEmail: string;
  shipping: SellerOrderDetailRow["shipping"];
}
interface FakeSellerOrder {
  id: string;
  orderId: string;
  sellerId: string;
  status: FulfillmentStatus;
  subtotal: number;
  trackingCode: string | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items: SellerOrderItemRow[];
}
interface FakeEvent extends SellerOrderEventRow {
  sellerOrderId: string;
  actorId: string | null;
}

/**
 * Repository درون‌حافظه‌ای با همان قرارداد Repository واقعی (از جمله دیده‌شدن فقط سفارش‌های PAID
 * و Compare-and-Set اتمیک). Rollback با Snapshot شبیه‌سازی می‌شود.
 */
export function createFakeSellerOrdersRepository() {
  const sellers: { id: string; userId: string; status: string }[] = [];
  const orders: FakeOrder[] = [];
  const sellerOrders: FakeSellerOrder[] = [];
  const events: FakeEvent[] = [];
  const faults = { failOnEvent: false };
  let clock = 1_790_000_000_000;
  let orderSeq = 1000;

  const visible = (sellerId: string, so: FakeSellerOrder) =>
    so.sellerId === sellerId && orders.find((o) => o.id === so.orderId)?.status === "PAID";

  const toDetail = (so: FakeSellerOrder): SellerOrderDetailRow => {
    const order = orders.find((o) => o.id === so.orderId)!;
    return {
      id: so.id,
      orderNumber: order.orderNumber,
      createdAt: so.createdAt,
      updatedAt: so.updatedAt,
      paidAt: order.paidAt,
      status: so.status,
      subtotal: so.subtotal,
      trackingCode: so.trackingCode,
      shippedAt: so.shippedAt,
      deliveredAt: so.deliveredAt,
      items: so.items.map((i) => ({ ...i })),
      shipping: { ...order.shipping },
      events: events
        .filter((e) => e.sellerOrderId === so.id)
        .map(({ sellerOrderId: _s, actorId: _a, ...rest }) => rest),
    };
  };

  const repository: SellerOrdersRepository = {
    async findSellerByUserId(userId) {
      const s = sellers.find((x) => x.userId === userId);
      return s ? { id: s.id, status: s.status } : null;
    },

    async list(sellerId, { page, limit, status, from, toExclusive, orderNumber }) {
      const all = sellerOrders
        .filter((so) => visible(sellerId, so))
        .filter((so) => !status || so.status === status)
        .filter((so) => !from || so.createdAt >= from)
        .filter((so) => !toExclusive || so.createdAt < toExclusive)
        .filter(
          (so) =>
            orderNumber === undefined || orders.find((o) => o.id === so.orderId)?.orderNumber === orderNumber,
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
      const slice = all.slice((page - 1) * limit, page * limit).map((so) => ({
        id: so.id,
        orderNumber: orders.find((o) => o.id === so.orderId)!.orderNumber,
        createdAt: so.createdAt,
        status: so.status,
        subtotal: so.subtotal,
        trackingCode: so.trackingCode,
        items: so.items.map((i) => ({ quantity: i.quantity, imageUrl: i.imageUrl })),
      }));
      return { items: slice, total: all.length };
    },

    async aggregateByStatus(sellerId) {
      const groups = new Map<FulfillmentStatus, { count: number; total: number }>();
      for (const so of sellerOrders.filter((x) => visible(sellerId, x))) {
        const g = groups.get(so.status) ?? { count: 0, total: 0 };
        g.count += 1;
        g.total += so.subtotal;
        groups.set(so.status, g);
      }
      return [...groups.entries()].map(([status, g]) => ({ status, ...g }));
    },

    async findOwned(sellerId, sellerOrderId) {
      const so = sellerOrders.find((x) => x.id === sellerOrderId && visible(sellerId, x));
      return so ? toDetail(so) : null;
    },

    async applyTransition(sellerId, sellerOrderId, { from, to, trackingCode, actorId }) {
      // اجازه می‌دهیم درخواست‌های همزمان قبل از CAS با هم تداخل نوبت پیدا کنند
      await new Promise((r) => setImmediate(r));
      const so = sellerOrders.find((x) => x.id === sellerOrderId);
      // شرط‌های CAS دقیقاً همان UPDATE واقعی: مالکیت + والد PAID + وضعیت مبدأ
      if (!so || !visible(sellerId, so) || so.status !== from) return null;

      const snapshot = { ...so };
      const eventCount = events.length;
      try {
        const now = new Date((clock += 1000));
        so.status = to;
        so.updatedAt = now;
        if (to === "SHIPPED") {
          so.trackingCode = trackingCode;
          so.shippedAt = now;
        }
        if (to === "DELIVERED") so.deliveredAt = now;
        if (faults.failOnEvent) throw new Error("injected failure");
        events.push({
          id: randomUUID(),
          sellerOrderId,
          fromStatus: from,
          toStatus: to,
          trackingCode: to === "SHIPPED" ? trackingCode : null,
          actorId,
          createdAt: now,
        });
        return toDetail(so);
      } catch (error) {
        Object.assign(so, snapshot); // Rollback
        events.length = eventCount;
        throw error;
      }
    },
  };

  return {
    repository,
    faults,
    events,
    sellerOrders,
    orders,
    addSeller(userId: string, status: string): string {
      const id = randomUUID();
      sellers.push({ id, userId, status });
      return id;
    },
    addOrder(
      data: { status?: OrderStatus; orderNumber?: number; customerEmail?: string; fullName?: string } = {},
    ): string {
      const id = randomUUID();
      const status = data.status ?? "PAID";
      orders.push({
        id,
        orderNumber: data.orderNumber ?? ++orderSeq,
        status,
        paidAt: status === "PENDING" ? null : new Date(clock),
        userId: randomUUID(),
        customerEmail: data.customerEmail ?? "customer-secret@example.com",
        shipping: {
          fullName: data.fullName ?? "گیرنده نمونه",
          phone: "09120000000",
          province: "تهران",
          city: "تهران",
          postalCode: "1234567890",
          addressLine: "خیابان نمونه، پلاک ۱",
        },
      });
      return id;
    },
    addSellerOrder(
      orderId: string,
      sellerId: string,
      data: {
        status?: FulfillmentStatus;
        createdAt?: Date;
        items?: { title: string; sku: string; quantity: number; unitPrice: number; imageUrl?: string | null }[];
      } = {},
    ): string {
      const id = randomUUID();
      const items = (data.items ?? [{ title: "کت پشمی", sku: "COAT-1", quantity: 2, unitPrice: 500_000 }]).map(
        (i): SellerOrderItemRow => ({
          id: randomUUID(),
          productTitle: i.title,
          sku: i.sku,
          size: "M",
          color: "مشکی",
          imageUrl: i.imageUrl ?? null,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        }),
      );
      const createdAt = data.createdAt ?? new Date((clock += 1000));
      sellerOrders.push({
        id,
        orderId,
        sellerId,
        status: data.status ?? "PENDING",
        subtotal: items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0),
        trackingCode: null,
        shippedAt: null,
        deliveredAt: null,
        createdAt,
        updatedAt: createdAt,
        items,
      });
      return id;
    },
    get: (id: string) => sellerOrders.find((x) => x.id === id)!,
  };
}
