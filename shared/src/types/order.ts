export type OrderStatus = "PENDING" | "PAID" | "CANCELLED" | "REFUNDED";
export type FulfillmentStatus = "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";

export interface OrderItemSummary {
  id: string;
  productSlug: string;
  productTitle: string;
  size: string;
  color: string;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface SellerOrderSummary {
  id: string;
  sellerStoreName: string;
  status: FulfillmentStatus;
  subtotal: number;
  items: OrderItemSummary[];
}

/** نمای فشرده برای فهرست سفارش‌ها */
export interface OrderListItem {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  totalAmount: number;
  itemCount: number;
  previewImageUrl: string | null;
  createdAt: string;
}

export interface ShippingAddressSnapshot {
  fullName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  addressLine: string;
}

export interface OrderDetail {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  totalAmount: number;
  shippingAddress: ShippingAddressSnapshot;
  sellerOrders: SellerOrderSummary[];
  createdAt: string;
  paidAt: string | null;
}
