import { randomUUID } from "node:crypto";
import type { OrderStatus, ProductStatusValue, SellerStatus, UserRole } from "@vista/shared";
import type { AuditInput } from "../../src/modules/admin/admin.audit";
import type { AdminCategoriesRepository, AdminCategoriesTx, AdminCategoryRow, CategoryRecord } from "../../src/modules/admin/adminCategories.repository";
import { DuplicateCategorySlugError } from "../../src/modules/admin/adminCategories.repository";
import type { AdminDashboardRepository } from "../../src/modules/admin/adminDashboard.repository";
import type { AdminOrdersRepository } from "../../src/modules/admin/adminOrders.repository";
import type { AdminProductsRepository, ProductDetailRow, ProductListRow } from "../../src/modules/admin/adminProducts.repository";
import type { AdminSellersRepository, SellerDetailRow, SellerListRow } from "../../src/modules/admin/adminSellers.repository";
import { tehranDayStart, tehranNextDayStart } from "../../src/utils/dateRange";

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

interface FakeUser {
  id: string;
  role: UserRole;
  fullName: string;
  email: string;
  phone: string | null;
  createdAt: Date;
}
interface FakeSeller {
  id: string;
  userId: string;
  storeName: string;
  storeSlug: string;
  description: string | null;
  status: SellerStatus;
  statusReason: string | null;
  statusChangedAt: Date | null;
  createdAt: Date;
}
interface FakeProduct {
  id: string;
  sellerId: string;
  categoryId: string;
  title: string;
  slug: string;
  status: ProductStatusValue;
  basePrice: number;
  description: string;
  createdAt: Date;
  variants: { id: string; size: string; color: string; sku: string; price: number | null; stock: number; isActive: boolean }[];
}
export interface FakeAudit extends AuditInput {
  id: string;
  createdAt: Date;
}
interface FakeOrder {
  id: string;
  orderNumber: number;
  userId: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: Date;
  sellerOrders: { id: string; sellerId: string; status: string; trackingCode: string | null }[];
}

/**
 * یک «دنیای» درون‌حافظه‌ای مشترک بین همهٔ Repositoryهای ادمین (تا اثر متقابل، مثل تعلیق فروشنده روی
 * محصولاتش، قابل تست باشد). هر نوشتن+ممیزی با Undo Log اتمیک است (مثل Transaction واقعی).
 */
export function createFakeAdminWorld() {
  const users = new Map<string, FakeUser>();
  const sellers = new Map<string, FakeSeller>();
  const products = new Map<string, FakeProduct>();
  const categories = new Map<string, CategoryRecord>();
  const orders: FakeOrder[] = [];
  const audit: FakeAudit[] = [];
  const faults = { failAudit: false };
  let clock = 1_790_000_000_000;
  let orderSeq = 1000;
  let treeLock: Promise<void> = Promise.resolve();

  const pushAudit = (input: AuditInput, undo: (() => void)[]) => {
    if (faults.failAudit) throw new Error("injected audit failure");
    const entry: FakeAudit = { ...input, id: randomUUID(), createdAt: new Date((clock += 1000)) };
    audit.push(entry);
    undo.push(() => audit.splice(audit.indexOf(entry), 1));
  };
  const rollback = (undo: (() => void)[]) => {
    for (const step of undo.reverse()) step();
  };
  const auditRows = (type: string, id: string) =>
    audit
      .filter((a) => a.targetType === type && a.targetId === id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((a) => ({
        id: a.id,
        action: a.action,
        fromStatus: a.fromStatus ?? null,
        toStatus: a.toStatus ?? null,
        reason: a.reason ?? null,
        createdAt: a.createdAt,
        actor: { fullName: users.get(a.adminId)?.fullName ?? "؟" },
      }));

  // ───────── seed helpers ─────────
  const addUser = (role: UserRole = "CUSTOMER", fullName = "کاربر", id: string = randomUUID()) => {
    users.set(id, {
      id,
      role,
      fullName,
      email: `${id.slice(0, 8)}@example.com`,
      phone: "09120000000",
      createdAt: new Date((clock += 1000)),
    });
    return id;
  };
  const addSeller = (status: SellerStatus = "PENDING", storeName = "فروشگاه", ownerRole: UserRole = "CUSTOMER") => {
    const userId = addUser(ownerRole, `مالک ${storeName}`);
    const id = randomUUID();
    sellers.set(id, {
      id,
      userId,
      storeName,
      storeSlug: `${storeName.replace(/\s+/g, "-")}-${id.slice(0, 4)}`,
      description: null,
      status,
      statusReason: null,
      statusChangedAt: null,
      createdAt: new Date((clock += 1000)),
    });
    return { sellerId: id, userId };
  };
  const addCategory = (name: string, slug: string, parentId: string | null = null, isActive = true) => {
    const id = randomUUID();
    categories.set(id, { id, name, slug, imageUrl: null, isActive, sortOrder: categories.size, parentId });
    return id;
  };
  const addProduct = (input: {
    sellerId: string;
    categoryId: string;
    title?: string;
    status?: ProductStatusValue;
    stocks?: number[];
  }) => {
    const id = randomUUID();
    products.set(id, {
      id,
      sellerId: input.sellerId,
      categoryId: input.categoryId,
      title: input.title ?? "کت",
      slug: `p-${id.slice(0, 6)}`,
      status: input.status ?? "PUBLISHED",
      basePrice: 1_000_000,
      description: "توضیح",
      createdAt: new Date((clock += 1000)),
      variants: (input.stocks ?? [3]).map((stock, i) => ({
        id: randomUUID(),
        size: `S${i}`,
        color: "مشکی",
        sku: `SKU-${id.slice(0, 4)}-${i}`,
        price: null,
        stock,
        isActive: true,
      })),
    });
    return id;
  };
  const addOrder = (input: { userId: string; status?: OrderStatus; sellerStatuses?: string[]; createdAt?: Date; total?: number }) => {
    const id = randomUUID();
    orders.push({
      id,
      orderNumber: ++orderSeq,
      userId: input.userId,
      status: input.status ?? "PENDING",
      totalAmount: input.total ?? 500_000,
      createdAt: input.createdAt ?? new Date((clock += 1000)),
      sellerOrders: (input.sellerStatuses ?? ["PENDING"]).map((status) => ({
        id: randomUUID(),
        sellerId: [...sellers.keys()][0] ?? "",
        status,
        trackingCode: null,
      })),
    });
    return id;
  };

  // ───────── repositories ─────────
  const sellerRow = (s: FakeSeller): SellerListRow => ({
    id: s.id,
    storeName: s.storeName,
    storeSlug: s.storeSlug,
    status: s.status,
    createdAt: s.createdAt,
    ownerName: users.get(s.userId)!.fullName,
    ownerEmail: users.get(s.userId)!.email,
    productCount: [...products.values()].filter((p) => p.sellerId === s.id).length,
  });

  const sellersRepository: AdminSellersRepository = {
    async list({ page, limit, q, status }) {
      await tick();
      const needle = q?.toLowerCase();
      const rows = [...sellers.values()]
        .filter((s) => !status || s.status === status)
        .map(sellerRow)
        .filter(
          (r) =>
            !needle ||
            [r.storeName, r.storeSlug, r.ownerEmail, r.ownerName].some((v) => v.toLowerCase().includes(needle)),
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return { items: rows.slice((page - 1) * limit, page * limit), total: rows.length };
    },
    async findDetail(sellerId): Promise<SellerDetailRow | null> {
      await tick();
      const s = sellers.get(sellerId);
      if (!s) return null;
      const owner = users.get(s.userId)!;
      const counts = { DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0 };
      for (const p of products.values()) if (p.sellerId === sellerId) counts[p.status] += 1;
      return {
        id: s.id,
        storeName: s.storeName,
        storeSlug: s.storeSlug,
        description: s.description,
        status: s.status,
        statusReason: s.statusReason,
        statusChangedAt: s.statusChangedAt,
        createdAt: s.createdAt,
        owner: { name: owner.fullName, email: owner.email, phone: owner.phone, registeredAt: owner.createdAt },
        products: counts,
        sellerOrderCount: orders.flatMap((o) => o.sellerOrders).filter((so) => so.sellerId === sellerId).length,
        history: auditRows("SELLER", sellerId),
      };
    },
    async changeStatus(change) {
      await tick();
      const undo: (() => void)[] = [];
      try {
        const s = sellers.get(change.sellerId);
        if (!s || s.status !== change.from) return false;
        const before = { status: s.status, reason: s.statusReason, at: s.statusChangedAt };
        s.status = change.to;
        s.statusReason = change.reason;
        s.statusChangedAt = new Date(clock);
        undo.push(() => Object.assign(s, { status: before.status, statusReason: before.reason, statusChangedAt: before.at }));
        if (change.to === "APPROVED") {
          const owner = users.get(s.userId)!;
          if (owner.role === "CUSTOMER") {
            owner.role = "SELLER";
            undo.push(() => (owner.role = "CUSTOMER"));
          }
        }
        await tick();
        pushAudit(
          {
            adminId: change.adminId,
            action: "SELLER_STATUS_CHANGED",
            targetType: "SELLER",
            targetId: change.sellerId,
            fromStatus: change.from,
            toStatus: change.to,
            reason: change.reason,
          },
          undo,
        );
        return true;
      } catch (error) {
        rollback(undo);
        throw error;
      }
    },
  };

  const productRow = (p: FakeProduct): ProductListRow => {
    const seller = sellers.get(p.sellerId)!;
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      status: p.status,
      basePrice: p.basePrice,
      categoryName: categories.get(p.categoryId)!.name,
      sellerId: seller.id,
      sellerName: seller.storeName,
      sellerStatus: seller.status,
      totalStock: p.variants.reduce((sum, v) => sum + v.stock, 0),
      createdAt: p.createdAt,
    };
  };
  const productsRepository: AdminProductsRepository = {
    async list({ page, limit, q, status, categoryId, sellerId, blockedSellers }) {
      await tick();
      const needle = q?.toLowerCase();
      const rows = [...products.values()]
        .filter((p) => !status || p.status === status)
        .filter((p) => !categoryId || p.categoryId === categoryId)
        .filter((p) => !sellerId || p.sellerId === sellerId)
        .filter((p) => {
          if (blockedSellers === undefined) return true;
          const approved = sellers.get(p.sellerId)!.status === "APPROVED";
          return blockedSellers ? !approved : approved;
        })
        .filter((p) => !needle || p.title.toLowerCase().includes(needle) || p.slug.includes(needle))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return { items: rows.slice((page - 1) * limit, page * limit).map(productRow), total: rows.length };
    },
    async findDetail(productId): Promise<ProductDetailRow | null> {
      await tick();
      const p = products.get(productId);
      if (!p) return null;
      return {
        ...productRow(p),
        description: p.description,
        compareAtPrice: null,
        images: [{ url: "https://img.example/1.jpg", altText: null }],
        variants: p.variants.map((v) => ({ ...v })),
        history: auditRows("PRODUCT", productId),
      };
    },
    async changeStatus(change) {
      await tick();
      const undo: (() => void)[] = [];
      try {
        const p = products.get(change.productId);
        if (!p || p.status !== change.from) return false;
        const before = p.status;
        p.status = change.to;
        undo.push(() => (p.status = before));
        await tick();
        pushAudit(
          {
            adminId: change.adminId,
            action: "PRODUCT_STATUS_CHANGED",
            targetType: "PRODUCT",
            targetId: change.productId,
            fromStatus: change.from,
            toStatus: change.to,
            reason: change.reason,
          },
          undo,
        );
        return true;
      } catch (error) {
        rollback(undo);
        throw error;
      }
    },
  };

  const categoryRow = (c: CategoryRecord): AdminCategoryRow => ({
    ...c,
    parentName: c.parentId ? (categories.get(c.parentId)?.name ?? null) : null,
    productCount: [...products.values()].filter((p) => p.categoryId === c.id).length,
    childCount: [...categories.values()].filter((x) => x.parentId === c.id).length,
  });
  const categoriesRepository: AdminCategoriesRepository = {
    async listAll() {
      await tick();
      return [...categories.values()]
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        .map(categoryRow);
    },
    async transaction(work) {
      const undo: (() => void)[] = [];
      let release: (() => void) | undefined;
      const tx: AdminCategoriesTx = {
        async lockTree() {
          const previous = treeLock;
          const mine = new Promise<void>((resolve) => (release = resolve));
          treeLock = previous.then(() => mine);
          await previous;
        },
        async findById(id) {
          await tick();
          const c = categories.get(id);
          return c ? { ...c } : null;
        },
        async findWithCounts(id) {
          await tick();
          const c = categories.get(id);
          return c ? categoryRow(c) : null;
        },
        async slugTaken(slug, exceptId) {
          await tick();
          return [...categories.values()].some((c) => c.slug === slug && c.id !== exceptId);
        },
        async ancestorIds(id) {
          await tick();
          const chain: string[] = [];
          let current = categories.get(id)?.parentId ?? null;
          for (let guard = 0; current && guard < 100; guard += 1) {
            chain.push(current);
            current = categories.get(current)?.parentId ?? null;
          }
          return chain;
        },
        async create(data) {
          await tick();
          if ([...categories.values()].some((c) => c.slug === data.slug)) throw new DuplicateCategorySlugError();
          const id = randomUUID();
          categories.set(id, { id, ...data });
          undo.push(() => categories.delete(id));
          return { id, ...data };
        },
        async update(id, patch) {
          await tick();
          const c = categories.get(id)!;
          if (patch.slug && [...categories.values()].some((x) => x.slug === patch.slug && x.id !== id)) {
            throw new DuplicateCategorySlugError();
          }
          const before = { ...c };
          Object.assign(c, patch);
          undo.push(() => Object.assign(c, before));
          return { ...c };
        },
        async counts(id) {
          await tick();
          const ps = [...products.values()].filter((p) => p.categoryId === id);
          const kids = [...categories.values()].filter((c) => c.parentId === id);
          return {
            products: ps.length,
            publishedProducts: ps.filter((p) => p.status === "PUBLISHED").length,
            children: kids.length,
            activeChildren: kids.filter((c) => c.isActive).length,
          };
        },
        async remove(id) {
          await tick();
          const before = categories.get(id)!;
          categories.delete(id);
          undo.push(() => categories.set(id, before));
        },
        async audit(input) {
          await tick();
          pushAudit(input, undo);
        },
      };
      try {
        return await work(tx);
      } catch (error) {
        rollback(undo);
        throw error;
      } finally {
        release?.();
      }
    },
  };

  const ordersRepository: AdminOrdersRepository = {
    async list({ page, limit, orderNumber, orderId, status, from, to }) {
      await tick();
      const rows = orders
        .filter((o) => orderNumber === undefined || o.orderNumber === orderNumber)
        .filter((o) => !orderId || o.id === orderId)
        .filter((o) => !status || o.status === status)
        .filter((o) => !from || o.createdAt >= tehranDayStart(from))
        .filter((o) => !to || o.createdAt < tehranNextDayStart(to))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return {
        total: rows.length,
        items: rows.slice((page - 1) * limit, page * limit).map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          totalAmount: o.totalAmount,
          createdAt: o.createdAt,
          customerName: users.get(o.userId)!.fullName,
          sellerOrders: o.sellerOrders.map((so) => ({ status: so.status })),
        })),
      };
    },
    async findDetail(orderId) {
      await tick();
      const o = orders.find((x) => x.id === orderId);
      if (!o) return null;
      const u = users.get(o.userId)!;
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        subtotal: o.totalAmount,
        shippingCost: 0,
        discountAmount: 0,
        totalAmount: o.totalAmount,
        createdAt: o.createdAt,
        paidAt: null,
        cancelledAt: null,
        customer: { name: u.fullName, email: u.email, phone: u.phone },
        shipping: { fullName: "گیرنده", phone: "09120000000", province: "تهران", city: "تهران", postalCode: "1234567890", addressLine: "خیابان" },
        sellerOrders: o.sellerOrders.map((so) => ({
          id: so.id,
          sellerId: so.sellerId,
          sellerName: sellers.get(so.sellerId)?.storeName ?? "؟",
          status: so.status,
          subtotal: o.totalAmount,
          trackingCode: so.trackingCode,
          shippedAt: null,
          deliveredAt: null,
          items: [{ id: `${so.id}-i`, productTitle: "کت", sku: "SKU", size: "M", color: "مشکی", quantity: 2, unitPrice: 250_000 }],
          events: [],
        })),
      };
    },
  };

  const dashboardRepository: AdminDashboardRepository = {
    async load() {
      await tick();
      const sellerCounts = { PENDING: 0, APPROVED: 0, SUSPENDED: 0, REJECTED: 0 };
      for (const s of sellers.values()) sellerCounts[s.status] += 1;
      const productCounts = { DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0 };
      for (const p of products.values()) productCounts[p.status] += 1;
      const orderCounts = { PENDING: 0, PAID: 0, CANCELLED: 0, REFUNDED: 0 };
      for (const o of orders) orderCounts[o.status] += 1;
      return {
        customers: [...users.values()].filter((u) => u.role === "CUSTOMER").length,
        sellers: sellerCounts,
        products: productCounts,
        orders: orderCounts,
        recentOrders: [...orders]
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 5)
          .map((o) => ({ id: o.id, orderNumber: o.orderNumber, status: o.status, totalAmount: o.totalAmount, createdAt: o.createdAt })),
        recentSellers: [...sellers.values()]
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 5)
          .map((s) => ({ id: s.id, storeName: s.storeName, status: s.status, createdAt: s.createdAt })),
      };
    },
  };

  return {
    users,
    sellers,
    products,
    categories,
    orders,
    audit,
    faults,
    addUser,
    addSeller,
    addCategory,
    addProduct,
    addOrder,
    findUserRole: async (userId: string): Promise<UserRole | null> => users.get(userId)?.role ?? null,
    repositories: {
      sellers: sellersRepository,
      products: productsRepository,
      categories: categoriesRepository,
      orders: ordersRepository,
      dashboard: dashboardRepository,
    },
  };
}
