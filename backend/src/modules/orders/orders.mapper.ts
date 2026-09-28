import type { OrderDetail, OrderListItem } from "@vista/shared";
import type { OrderWithRelations } from "./orders.repository";

export function toOrderDetail(order: OrderWithRelations): OrderDetail {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status as OrderDetail["status"],
    subtotal: order.subtotal,
    shippingCost: order.shippingCost,
    discountAmount: order.discountAmount,
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
      status: so.status as OrderDetail["sellerOrders"][number]["status"],
      subtotal: so.subtotal,
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
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt ? order.paidAt.toISOString() : null,
  };
}

export function toOrderListItem(order: OrderWithRelations): OrderListItem {
  const allItems = order.sellerOrders.flatMap((so) => so.items);
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status as OrderListItem["status"],
    totalAmount: order.totalAmount,
    itemCount: allItems.reduce((sum, item) => sum + item.quantity, 0),
    previewImageUrl: allItems[0]?.imageUrl ?? null,
    createdAt: order.createdAt.toISOString(),
  };
}
