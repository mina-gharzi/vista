import type { CartItemSummary, CartSummary } from "@vista/shared";
import type { CartItemRow } from "./cart.repository";

function toCartItem(row: CartItemRow): CartItemSummary {
  const unitPrice = row.variant.price ?? row.variant.product.basePrice;
  return {
    variantId: row.variant.id,
    productId: row.variant.product.id,
    productSlug: row.variant.product.slug,
    productTitle: row.variant.product.title,
    imageUrl: row.variant.product.images[0]?.url ?? null,
    size: row.variant.size,
    color: row.variant.color,
    quantity: row.quantity,
    unitPrice,
    lineTotal: unitPrice * row.quantity,
    availableStock: row.variant.stock,
    isAvailable: row.variant.product.status === "PUBLISHED" && row.variant.stock >= row.quantity,
  };
}

export function toCartSummary(rows: CartItemRow[]): CartSummary {
  const items = rows.map(toCartItem);
  return {
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
  };
}
