import { randomUUID } from "node:crypto";
import type {
  CartItemRow,
  CartRepository,
  VariantForCart,
} from "../../src/modules/cart/cart.repository";

interface StoredVariant {
  id: string;
  size: string;
  color: string;
  price: number | null;
  stock: number;
  productStatus: string;
  product: {
    id: string;
    slug: string;
    title: string;
    basePrice: number;
    imageUrl?: string | null;
  };
}

/** پیاده‌سازی درون‌حافظه‌ای CartRepository برای تست بدون Database واقعی. */
export class FakeCartRepository implements CartRepository {
  private readonly variants = new Map<string, StoredVariant>();
  // cartId مصنوعی: userId خودش کلید سبد است (رابطه یک‌به‌یک User↔Cart)
  private readonly items = new Map<string, Map<string, number>>(); // userId -> variantId -> quantity

  seedVariant(input: {
    size: string;
    color: string;
    price?: number | null;
    stock: number;
    productStatus?: string;
    basePrice?: number;
    title?: string;
    imageUrl?: string | null;
  }): string {
    const id = randomUUID();
    this.variants.set(id, {
      id,
      size: input.size,
      color: input.color,
      price: input.price ?? null,
      stock: input.stock,
      productStatus: input.productStatus ?? "PUBLISHED",
      product: {
        id: randomUUID(),
        slug: `product-${id.slice(0, 8)}`,
        title: input.title ?? "محصول نمونه",
        basePrice: input.basePrice ?? 100_000,
        imageUrl: input.imageUrl ?? null,
      },
    });
    return id;
  }

  setStock(variantId: string, stock: number): void {
    const variant = this.variants.get(variantId);
    if (variant) variant.stock = stock;
  }

  setProductStatus(variantId: string, status: string): void {
    const variant = this.variants.get(variantId);
    if (variant) variant.productStatus = status;
  }

  async findVariantForCart(variantId: string): Promise<VariantForCart | null> {
    const variant = this.variants.get(variantId);
    if (!variant) return null;
    return { id: variant.id, stock: variant.stock, product: { status: variant.productStatus } };
  }

  async getItems(userId: string): Promise<CartItemRow[]> {
    const cart = this.items.get(userId);
    if (!cart) return [];
    const rows: CartItemRow[] = [];
    for (const [variantId, quantity] of cart) {
      const variant = this.variants.get(variantId);
      if (!variant) continue; // Variant حذف‌شده — مثل Cascade واقعی نادیده گرفته می‌شود
      rows.push({
        quantity,
        variant: {
          id: variant.id,
          size: variant.size,
          color: variant.color,
          price: variant.price,
          stock: variant.stock,
          product: {
            id: variant.product.id,
            slug: variant.product.slug,
            title: variant.product.title,
            basePrice: variant.product.basePrice,
            status: variant.productStatus,
            images: variant.product.imageUrl ? [{ url: variant.product.imageUrl }] : [],
          },
        },
      });
    }
    return rows;
  }

  async getItemQuantity(userId: string, variantId: string): Promise<number> {
    return this.items.get(userId)?.get(variantId) ?? 0;
  }

  async upsertItem(userId: string, variantId: string, quantity: number): Promise<void> {
    const cart = this.items.get(userId) ?? new Map<string, number>();
    cart.set(variantId, quantity);
    this.items.set(userId, cart);
  }

  async removeItem(userId: string, variantId: string): Promise<void> {
    this.items.get(userId)?.delete(variantId);
  }
}
