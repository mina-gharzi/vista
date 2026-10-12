import { randomUUID } from "node:crypto";
import {
  DuplicateCheckoutKeyError,
  type AddressRow,
  type CancelTarget,
  type CartLine,
  type MovementRow,
  type NewOrderData,
  type OrderListRow,
  type OrderWithRelations,
  type OrdersRepository,
  type OrdersTx,
} from "../../src/modules/orders/orders.repository";

interface FakeVariant {
  id: string;
  stock: number;
  active: boolean;
  price: number | null;
  basePrice: number;
  title: string;
  slug: string;
  productStatus: string;
  sellerId: string;
  size: string;
  color: string;
  sku: string;
}

interface FakeOrderRow {
  id: string;
  orderNumber: number;
  userId: string;
  checkoutKey: string | null;
  status: string;
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  totalAmount: number;
  address: Omit<AddressRow, "id">;
  paidAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  sellerOrders: {
    id: string;
    sellerId: string;
    status: string;
    subtotal: number;
    trackingCode: string | null;
    items: NewOrderData["sellerOrders"][number]["items"];
  }[];
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

/**
 * Repository درون‌حافظه‌ای با همان قرارداد Repository واقعی:
 *  - Transaction با «Undo Log» (Rollback واقعی حتی وقتی تراکنش‌های دیگر همزمان‌اند)
 *  - lockUser = قفل واقعی (صف) مثل pg_advisory_xact_lock
 *  - decrementStock اتمیک و شرطی (مثل UPDATE … WHERE stock >= n)
 *  - ایندکس یکتای (userId, checkoutKey)
 *  - هر عملیات یک `await tick()` دارد تا Promise.all واقعاً Interleave شود.
 */
export function createFakeOrdersRepository() {
  const sellers = new Map<string, { status: string; storeName: string }>();
  const variants = new Map<string, FakeVariant>();
  const carts = new Map<string, { variantId: string; quantity: number }[]>();
  const addresses: (AddressRow & { userId: string })[] = [];
  const orders: FakeOrderRow[] = [];
  const movements: (MovementRow & { createdAt: number })[] = [];
  const faults = { failOnCreateOrder: false, failOnRecordMovements: false };
  const locks = new Map<string, Promise<void>>();
  let orderSeq = 1000;
  let clock = 1_790_000_000_000;

  const toOrder = (row: FakeOrderRow): OrderWithRelations => ({
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status,
    subtotal: row.subtotal,
    shippingCost: row.shippingCost,
    discountAmount: row.discountAmount,
    totalAmount: row.totalAmount,
    shippingFullName: row.address.fullName,
    shippingPhone: row.address.phone,
    shippingProvince: row.address.province,
    shippingCity: row.address.city,
    shippingPostalCode: row.address.postalCode,
    shippingAddressLine: row.address.addressLine,
    createdAt: new Date(row.createdAt),
    paidAt: row.paidAt,
    cancelledAt: row.cancelledAt,
    sellerOrders: row.sellerOrders.map((so) => ({
      id: so.id,
      status: so.status,
      subtotal: so.subtotal,
      trackingCode: so.trackingCode,
      shippedAt: null,
      deliveredAt: null,
      seller: { storeName: sellers.get(so.sellerId)?.storeName ?? "؟" },
      items: so.items.map((item, index) => ({
        id: `${so.id}-item-${index}`,
        ...item,
        variant: { product: { slug: variants.get(item.variantId)?.slug ?? "x" } },
      })),
    })),
  });

  const buildTx = (undo: (() => void)[], releases: (() => void)[]): OrdersTx => ({
    async lockUser(userId) {
      await tick();
      const previous = locks.get(userId) ?? Promise.resolve();
      let release!: () => void;
      const mine = new Promise<void>((resolve) => (release = resolve));
      locks.set(
        userId,
        previous.then(() => mine),
      );
      await previous;
      releases.push(release);
    },

    async findByCheckoutKey(userId, checkoutKey) {
      await tick();
      const row = orders.find((o) => o.userId === userId && o.checkoutKey === checkoutKey);
      return row ? toOrder(row) : null;
    },

    async findAddress(userId, addressId) {
      await tick();
      const found = addresses.find((a) => a.id === addressId && a.userId === userId);
      if (!found) return null;
      const { userId: _owner, ...rest } = found;
      return rest;
    },

    async loadCartLines(userId): Promise<CartLine[]> {
      await tick();
      return (carts.get(userId) ?? []).map((item) => {
        const v = variants.get(item.variantId)!;
        return {
          variantId: v.id,
          quantity: item.quantity,
          variantActive: v.active,
          stock: v.stock,
          variantPrice: v.price,
          basePrice: v.basePrice,
          productStatus: v.productStatus,
          productSlug: v.slug,
          productTitle: v.title,
          imageUrl: null,
          sku: v.sku,
          size: v.size,
          color: v.color,
          sellerId: v.sellerId,
          sellerStatus: sellers.get(v.sellerId)?.status ?? "PENDING",
        };
      });
    },

    async decrementStock(variantId, quantity) {
      await tick();
      const v = variants.get(variantId);
      if (!v || v.stock < quantity) return null;
      v.stock -= quantity;
      undo.push(() => {
        v.stock += quantity;
      });
      return v.stock;
    },

    async incrementStock(variantId, quantity) {
      await tick();
      const v = variants.get(variantId)!;
      v.stock += quantity;
      undo.push(() => {
        v.stock -= quantity;
      });
      return v.stock;
    },

    async createOrder(data) {
      await tick();
      if (faults.failOnCreateOrder) throw new Error("injected createOrder failure");
      if (orders.some((o) => o.userId === data.userId && o.checkoutKey === data.checkoutKey)) {
        throw new DuplicateCheckoutKeyError();
      }
      const row: FakeOrderRow = {
        id: randomUUID(),
        orderNumber: ++orderSeq,
        userId: data.userId,
        checkoutKey: data.checkoutKey,
        status: "PENDING",
        subtotal: data.subtotal,
        shippingCost: data.shippingCost,
        discountAmount: data.discountAmount,
        totalAmount: data.totalAmount,
        address: data.address,
        paidAt: null,
        cancelledAt: null,
        createdAt: new Date((clock += 1000)),
        sellerOrders: data.sellerOrders.map((so) => ({
          id: randomUUID(),
          sellerId: so.sellerId,
          status: "PENDING",
          subtotal: so.subtotal,
          trackingCode: null,
          items: so.items,
        })),
      };
      orders.push(row);
      undo.push(() => {
        orders.splice(orders.indexOf(row), 1);
      });
      return toOrder(row);
    },

    async recordMovements(rows) {
      await tick();
      if (faults.failOnRecordMovements) throw new Error("injected movement failure");
      const added = rows.map((row) => ({ ...row, createdAt: ++clock }));
      movements.push(...added);
      undo.push(() => {
        for (const m of added) movements.splice(movements.indexOf(m), 1);
      });
    },

    async clearCart(userId) {
      await tick();
      const previous = carts.get(userId) ?? [];
      carts.set(userId, []);
      undo.push(() => {
        carts.set(userId, previous);
      });
    },

    async lockOwnedOrder(userId, orderId): Promise<CancelTarget | null> {
      await tick();
      const row = orders.find((o) => o.id === orderId && o.userId === userId);
      if (!row) return null;
      return {
        id: row.id,
        status: row.status,
        sellerOrderStatuses: row.sellerOrders.map((so) => so.status),
        items: row.sellerOrders.flatMap((so) =>
          so.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        ),
      };
    },

    async markOrderCancelled(orderId) {
      await tick();
      const row = orders.find((o) => o.id === orderId);
      if (!row || row.status !== "PENDING") return false;
      row.status = "CANCELLED";
      row.cancelledAt = new Date(clock);
      undo.push(() => {
        row.status = "PENDING";
        row.cancelledAt = null;
      });
      return true;
    },

    async cancelPendingSellerOrders(orderId) {
      await tick();
      const row = orders.find((o) => o.id === orderId)!;
      const changed = row.sellerOrders.filter((so) => so.status === "PENDING");
      for (const so of changed) so.status = "CANCELLED";
      undo.push(() => {
        for (const so of changed) so.status = "PENDING";
      });
      return changed.length;
    },

    async findOwnedById(userId, orderId) {
      await tick();
      const row = orders.find((o) => o.id === orderId && o.userId === userId);
      return row ? toOrder(row) : null;
    },
  });

  const repository: OrdersRepository = {
    async transaction(work) {
      const undo: (() => void)[] = [];
      const releases: (() => void)[] = [];
      try {
        return await work(buildTx(undo, releases));
      } catch (error) {
        for (const step of undo.reverse()) step();
        throw error;
      } finally {
        for (const release of releases) release();
      }
    },

    async findByCheckoutKey(userId, checkoutKey) {
      await tick();
      const row = orders.find((o) => o.userId === userId && o.checkoutKey === checkoutKey);
      return row ? toOrder(row) : null;
    },

    async markPaid(orderId, providerRef) {
      await tick();
      void providerRef;
      const row = orders.find((o) => o.id === orderId);
      if (!row || row.status !== "PENDING") return false;
      row.status = "PAID";
      row.paidAt = new Date(clock);
      return true;
    },

    async findById(orderId) {
      await tick();
      const row = orders.find((o) => o.id === orderId);
      return row ? toOrder(row) : null;
    },

    async findManyForUser(userId, { page, limit, status }) {
      await tick();
      const mine = orders
        .filter((o) => o.userId === userId && (!status || o.status === status))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const items: OrderListRow[] = mine.slice((page - 1) * limit, page * limit).map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        totalAmount: o.totalAmount,
        createdAt: o.createdAt,
        sellerOrders: o.sellerOrders.map((so) => ({
          status: so.status,
          items: so.items.map((i) => ({ quantity: i.quantity, imageUrl: i.imageUrl })),
        })),
      }));
      return { items, total: mine.length };
    },

    async findOwnedById(userId, orderId) {
      await tick();
      const row = orders.find((o) => o.id === orderId && o.userId === userId);
      return row ? toOrder(row) : null;
    },
  };

  let variantSeq = 0;
  return {
    repository,
    faults,
    orders,
    movements,
    addSeller(status = "APPROVED", storeName = `فروشگاه ${sellers.size + 1}`) {
      const id = randomUUID();
      sellers.set(id, { status, storeName });
      return id;
    },
    setSellerStatus(sellerId: string, status: string) {
      sellers.get(sellerId)!.status = status;
    },
    addVariant(input: {
      sellerId: string;
      stock: number;
      basePrice?: number;
      price?: number | null;
      title?: string;
      productStatus?: string;
      active?: boolean;
    }) {
      const id = randomUUID();
      variantSeq += 1;
      variants.set(id, {
        id,
        stock: input.stock,
        active: input.active ?? true,
        price: input.price ?? null,
        basePrice: input.basePrice ?? 1_000_000,
        title: input.title ?? `کت ${variantSeq}`,
        slug: `coat-${variantSeq}`,
        productStatus: input.productStatus ?? "PUBLISHED",
        sellerId: input.sellerId,
        size: "M",
        color: "مشکی",
        sku: `SKU-${variantSeq}`,
      });
      return id;
    },
    variant: (id: string) => variants.get(id)!,
    stock: (id: string) => variants.get(id)!.stock,
    addToCart(userId: string, variantId: string, quantity: number) {
      carts.set(userId, [...(carts.get(userId) ?? []), { variantId, quantity }]);
    },
    cart: (userId: string) => carts.get(userId) ?? [],
    addAddress(userId: string) {
      const id = randomUUID();
      addresses.push({
        id,
        userId,
        fullName: "مینا قرزی",
        phone: "09120000000",
        province: "تهران",
        city: "تهران",
        postalCode: "1234567890",
        addressLine: "خیابان ولیعصر، پلاک ۱",
      });
      return id;
    },
    setSellerOrderStatus(orderId: string, sellerId: string, status: string, trackingCode?: string) {
      const so = orders.find((o) => o.id === orderId)!.sellerOrders.find((s) => s.sellerId === sellerId)!;
      so.status = status;
      if (trackingCode) so.trackingCode = trackingCode;
    },
    setOrderStatus(orderId: string, status: string) {
      orders.find((o) => o.id === orderId)!.status = status;
    },
    movementsFor: (variantId: string) => movements.filter((m) => m.variantId === variantId),
  };
}
