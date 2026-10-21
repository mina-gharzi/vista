import type { Prisma, PrismaClient } from "@prisma/client";
import { tehranDayStart, tehranNextDayStart } from "../../utils/dateRange";

export interface AdminOrderListRow {
  id: string;
  orderNumber: number;
  status: string;
  totalAmount: number;
  createdAt: Date;
  customerName: string;
  sellerOrders: { status: string }[];
}

export interface AdminOrderDetailRow {
  id: string;
  orderNumber: number;
  status: string;
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  couponCode: string | null;
  totalAmount: number;
  createdAt: Date;
  paidAt: Date | null;
  cancelledAt: Date | null;
  customer: { name: string; email: string; phone: string | null };
  shipping: {
    fullName: string;
    phone: string;
    province: string;
    city: string;
    postalCode: string;
    addressLine: string;
  };
  sellerOrders: {
    id: string;
    sellerId: string;
    sellerName: string;
    status: string;
    subtotal: number;
    discountAmount: number;
    trackingCode: string | null;
    shippedAt: Date | null;
    deliveredAt: Date | null;
    items: {
      id: string;
      productTitle: string;
      sku: string;
      size: string;
      color: string;
      quantity: number;
      unitPrice: number;
    }[];
    events: {
      id: string;
      fromStatus: string;
      toStatus: string;
      trackingCode: string | null;
      createdAt: Date;
    }[];
  }[];
}

export interface AdminOrdersRepository {
  list(params: {
    page: number;
    limit: number;
    /** فقط شمارهٔ سفارش (عدد) یا شناسهٔ کامل؛ فرمت نامعتبر در Service پاک می‌شود */
    orderNumber?: number | undefined;
    orderId?: string | undefined;
    status?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
  }): Promise<{ items: AdminOrderListRow[]; total: number }>;
  findDetail(orderId: string): Promise<AdminOrderDetailRow | null>;
}

export function createAdminOrdersRepository(prisma: PrismaClient): AdminOrdersRepository {
  return {
    async list({ page, limit, orderNumber, orderId, status, from, to }) {
      const where: Prisma.OrderWhereInput = {
        ...(status ? { status: status as Prisma.OrderWhereInput["status"] & string } : {}),
        ...(orderNumber !== undefined ? { orderNumber } : {}),
        ...(orderId ? { id: orderId } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: tehranDayStart(from) } : {}),
                ...(to ? { lt: tehranNextDayStart(to) } : {}),
              },
            }
          : {}),
      };
      const [rows, total] = await Promise.all([
        prisma.order.findMany({
          where,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            createdAt: true,
            user: { select: { fullName: true } },
            sellerOrders: { select: { status: true } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.order.count({ where }),
      ]);
      return {
        total,
        items: rows.map((row) => ({
          id: row.id,
          orderNumber: row.orderNumber,
          status: row.status,
          totalAmount: row.totalAmount,
          createdAt: row.createdAt,
          customerName: row.user.fullName,
          sellerOrders: row.sellerOrders,
        })),
      };
    },

    async findDetail(orderId) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          subtotal: true,
          shippingCost: true,
          discountAmount: true,
          couponCode: true,
          totalAmount: true,
          createdAt: true,
          paidAt: true,
          cancelledAt: true,
          shippingFullName: true,
          shippingPhone: true,
          shippingProvince: true,
          shippingCity: true,
          shippingPostalCode: true,
          shippingAddressLine: true,
          user: { select: { fullName: true, email: true, phone: true } },
          sellerOrders: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              sellerId: true,
              status: true,
              subtotal: true,
              discountAmount: true,
              trackingCode: true,
              shippedAt: true,
              deliveredAt: true,
              seller: { select: { storeName: true } },
              items: {
                orderBy: { id: "asc" },
                select: {
                  id: true,
                  productTitle: true,
                  sku: true,
                  size: true,
                  color: true,
                  quantity: true,
                  unitPrice: true,
                },
              },
              events: {
                orderBy: { createdAt: "asc" },
                select: { id: true, fromStatus: true, toStatus: true, trackingCode: true, createdAt: true },
              },
            },
          },
        },
      });
      if (!order) return null;
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        subtotal: order.subtotal,
        shippingCost: order.shippingCost,
        discountAmount: order.discountAmount,
        couponCode: order.couponCode,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
        cancelledAt: order.cancelledAt,
        customer: { name: order.user.fullName, email: order.user.email, phone: order.user.phone },
        shipping: {
          fullName: order.shippingFullName,
          phone: order.shippingPhone,
          province: order.shippingProvince,
          city: order.shippingCity,
          postalCode: order.shippingPostalCode,
          addressLine: order.shippingAddressLine,
        },
        sellerOrders: order.sellerOrders.map((so) => ({
          id: so.id,
          sellerId: so.sellerId,
          sellerName: so.seller.storeName,
          status: so.status,
          subtotal: so.subtotal,
          discountAmount: so.discountAmount,
          trackingCode: so.trackingCode,
          shippedAt: so.shippedAt,
          deliveredAt: so.deliveredAt,
          items: so.items,
          events: so.events,
        })),
      };
    },
  };
}
