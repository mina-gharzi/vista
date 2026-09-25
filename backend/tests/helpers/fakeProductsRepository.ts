import { randomUUID } from "node:crypto";
import type { ProductStatus } from "@vista/shared";
import type {
  CreateProductData,
  ProductWithRelations,
  ProductsRepository,
  UpdateProductFields,
} from "../../src/modules/products/products.repository";

interface StoredSeller {
  id: string;
  status: string;
}

/** پیاده‌سازی درون‌حافظه‌ای ProductsRepository برای تست بدون Database واقعی. */
export class FakeProductsRepository implements ProductsRepository {
  private readonly products = new Map<string, ProductWithRelations>();
  private readonly sellersByUserId = new Map<string, StoredSeller>();
  private readonly activeCategoryIds = new Set<string>();

  seedSeller(userId: string, status: "PENDING" | "APPROVED" | "SUSPENDED" = "APPROVED"): string {
    const sellerId = randomUUID();
    this.sellersByUserId.set(userId, { id: sellerId, status });
    return sellerId;
  }

  seedActiveCategory(): string {
    const id = randomUUID();
    this.activeCategoryIds.add(id);
    return id;
  }

  /** برای سناریوهای دسترسی: محصول را مستقیم (بدون عبور از createWithVariants) در حافظه می‌گذارد */
  seedProduct(
    overrides: Partial<ProductWithRelations> & { sellerId: string; categoryId: string },
  ): ProductWithRelations {
    const now = new Date();
    const product: ProductWithRelations = {
      id: randomUUID(),
      sellerId: overrides.sellerId,
      categoryId: overrides.categoryId,
      title: overrides.title ?? "محصول نمونه",
      slug: overrides.slug ?? `product-${randomUUID().slice(0, 8)}`,
      description: overrides.description ?? "توضیحات نمونه با طول کافی",
      basePrice: overrides.basePrice ?? 100_000,
      compareAtPrice: overrides.compareAtPrice ?? null,
      status: overrides.status ?? "DRAFT",
      createdAt: overrides.createdAt ?? now,
      updatedAt: overrides.updatedAt ?? now,
      variants: overrides.variants ?? [],
      images: overrides.images ?? [],
    };
    this.products.set(product.id, product);
    return product;
  }

  async findSellerByUserId(userId: string) {
    return this.sellersByUserId.get(userId) ?? null;
  }

  async categoryIsActive(categoryId: string) {
    return this.activeCategoryIds.has(categoryId);
  }

  async slugExists(slug: string) {
    return [...this.products.values()].some((product) => product.slug === slug);
  }

  async createWithVariants(data: CreateProductData, actorUserId: string) {
    const now = new Date();
    const product: ProductWithRelations = {
      id: randomUUID(),
      sellerId: data.sellerId,
      categoryId: data.categoryId,
      title: data.title,
      slug: data.slug,
      description: data.description,
      basePrice: data.basePrice,
      compareAtPrice: data.compareAtPrice ?? null,
      status: "DRAFT",
      createdAt: now,
      updatedAt: now,
      variants: data.variants.map((variant) => ({
        id: randomUUID(),
        productId: "", // بعد از ساخت product.id پر می‌شود
        sku: `VST-${randomUUID().slice(0, 6).toUpperCase()}`,
        size: variant.size,
        color: variant.color,
        price: variant.price ?? null,
        stock: variant.stock,
        version: 0,
      })),
      images: data.images.map((image, index) => ({
        id: randomUUID(),
        productId: "",
        url: image.url,
        altText: image.altText ?? null,
        position: index,
      })),
    };
    product.variants.forEach((v) => {
      (v as { productId: string }).productId = product.id;
    });
    void actorUserId; // ثبت InventoryMovement در Fake لازم نیست؛ فقط رفتار Repository واقعی را تقلید می‌کند
    this.products.set(product.id, product);
    return product;
  }

  async findOwnedById(sellerId: string, productId: string) {
    const product = this.products.get(productId);
    return product && product.sellerId === sellerId ? product : null;
  }

  async findManyForSeller(
    sellerId: string,
    params: { page: number; limit: number; status?: ProductStatus | undefined },
  ) {
    const all = [...this.products.values()]
      .filter((p) => p.sellerId === sellerId && (!params.status || p.status === params.status))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const start = (params.page - 1) * params.limit;
    return { items: all.slice(start, start + params.limit), total: all.length };
  }

  async updateFields(productId: string, patch: UpdateProductFields) {
    const product = this.products.get(productId);
    if (!product) throw new Error("test setup error: product not found");
    const updated: ProductWithRelations = {
      ...product,
      ...(patch.categoryId !== undefined ? { categoryId: patch.categoryId } : {}),
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.basePrice !== undefined ? { basePrice: patch.basePrice } : {}),
      ...(patch.compareAtPrice !== undefined ? { compareAtPrice: patch.compareAtPrice } : {}),
      updatedAt: new Date(),
    };
    this.products.set(productId, updated);
    return updated;
  }

  async updateStatus(productId: string, status: ProductStatus) {
    const product = this.products.get(productId);
    if (!product) throw new Error("test setup error: product not found");
    const updated = { ...product, status, updatedAt: new Date() };
    this.products.set(productId, updated);
    return updated;
  }
}
