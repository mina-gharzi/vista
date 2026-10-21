import {
  deriveOrderFulfillment,
  isOrderCancellableByCustomer,
  type FulfillmentStatus,
  type OrderDetail,
  type OrderListItem,
  type OrderStatus,
} from "@vista/shared";
import type { OrderListRow, OrderWithRelations } from "./orders.repository";

const iso = (date: Date | null): string | null => (date ? date.toISOString() : null);

export function toOrderDetail(order: OrderWithRelations): OrderDetail {
  const sellerStatuses = order.sellerOrders.map((so) => so.status as FulfillmentStatus);
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status as OrderStatus,
    subtotal: order.subtotal,
    shippingCost: order.shippingCost,
    discountAmount: order.discountAmount,
    couponCode: order.couponCode,
    totalAmount: order.totalAmount,
    shippingAddress: {
      fullName: order.shippingFullName,
      phone: order.shippingPhone,
      province: order.shippingProvince,
      city: order.shippingCity,
      postalCode: order.shippingPostalCode,
      addressLine: order.shippingAddressLine,
    },
    sellerOrders: order.sellerOrders.map((so) => ({
      id: so.id,
      sellerStoreName: so.seller.storeName,
      status: so.status as FulfillmentStatus,
      subtotal: so.subtotal,
      discountAmount: so.discountAmount,
      trackingCode: so.trackingCode,
      shippedAt: iso(so.shippedAt),
      deliveredAt: iso(so.deliveredAt),
      items: so.items.map((item) => ({
        id: item.id,
        productSlug: item.variant.product.slug,
        productTitle: item.productTitle,
        size: item.size,
        color: item.color,
        imageUrl: item.imageUrl,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.unitPrice * item.quantity,
      })),
    })),
    fulfillment: deriveOrderFulfillment(sellerStatuses),
    canCancel: isOrderCancellableByCustomer(order.status as OrderStatus, sellerStatuses),
    createdAt: order.createdAt.toISOString(),
    paidAt: iso(order.paidAt),
    cancelledAt: iso(order.cancelledAt),
  };
}

export function toOrderListItem(order: OrderListRow): OrderListItem {
  const sellerStatuses = order.sellerOrders.map((so) => so.status as FulfillmentStatus);
  const allItems = order.sellerOrders.flatMap((so) => so.items);
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status as OrderStatus,
    totalAmount: order.totalAmount,
    itemCount: allItems.reduce((sum, item) => sum + item.quantity, 0),
    previewImageUrl: allItems.find((item) => item.imageUrl)?.imageUrl ?? null,
    fulfillment: deriveOrderFulfillment(sellerStatuses),
    canCancel: isOrderCancellableByCustomer(order.status as OrderStatus, sellerStatuses),
    createdAt: order.createdAt.toISOString(),
  };
}
