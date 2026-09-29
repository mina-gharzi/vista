import { randomUUID } from "node:crypto";
import type {
  WishlistItemRow,
  WishlistRepository,
} from "../../src/modules/wishlist/wishlist.repository";

interface StoredProduct {
  id: string;
  slug: string;
  title: string;
  basePrice: number;
  compareAtPrice: number | null;
  status: string;
  categoryName: string;
  imageUrl: string | null;
}

/** پیاده‌سازی درون‌حافظه‌ای WishlistRepository برای تست بدون Database واقعی. */
export class FakeWishlistRepository implements WishlistRepository {
  private readonly products = new Map<string, StoredProduct>();
  private readonly items = new Map<string, Map<string, Date>>(); // userId -> productId -> addedAt

  seedProduct(
    input: {
      status?: string;
      title?: string;
      basePrice?: number;
      compareAtPrice?: number | null;
      categoryName?: string;
      imageUrl?: string | null;
    } = {},
  ): string {
    const id = randomUUID();
    this.products.set(id, {
      id,
      slug: `product-${id.slice(0, 8)}`,
      title: input.title ?? "محصول نمونه",
      basePrice: input.basePrice ?? 100_000,
      compareAtPrice: input.compareAtPrice ?? null,
      status: input.status ?? "PUBLISHED",
      categoryName: input.categoryName ?? "زنانه",
      imageUrl: input.imageUrl ?? null,
    });
    return id;
  }

  async findAllForUser(userId: string): Promise<WishlistItemRow[]> {
    const map = this.items.get(userId);
    if (!map) return [];
    const rows: WishlistItemRow[] = [];
    for (const [productId, addedAt] of map) {
      const product = this.products.get(productId);
      if (!product) continue;
      rows.push({
        productId,
        createdAt: addedAt,
        product: {
          slug: product.slug,
          title: product.title,
          basePrice: product.basePrice,
          compareAtPrice: product.compareAtPrice,
          status: product.status,
          category: { name: product.categoryName },
          images: product.imageUrl ? [{ url: product.imageUrl }] : [],
        },
      });
    }
    return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async isWishlisted(userId: string, productId: string): Promise<boolean> {
    return this.items.get(userId)?.has(productId) ?? false;
  }

  async productExists(productId: string): Promise<boolean> {
    return this.products.has(productId);
  }

  async add(userId: string, productId: string): Promise<void> {
    const map = this.items.get(userId) ?? new Map<string, Date>();
    if (!map.has(productId)) map.set(productId, new Date());
    this.items.set(userId, map);
  }

  async remove(userId: string, productId: string): Promise<void> {
    this.items.get(userId)?.delete(productId);
  }
}
