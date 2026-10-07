import { ConflictError } from "../../src/errors/AppError";
import {
  SLUG_TAKEN_MESSAGE,
  type CreateProductData,
  type ProductWithRelations,
  type ProductsRepository,
  type UpdateProductFields,
} from "../../src/modules/products/products.repository";

export const DEFAULT_CATEGORY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type Status = "DRAFT" | "PUBLISHED" | "ARCHIVED";

/**
 * Repository درون‌حافظه‌ای با «همان قرارداد» Repository واقعی. داده چند فروشنده همزمان نگه داشته می‌شود
 * و findOwnedById / findManyForSeller فقط با sellerId فیلتر می‌کنند — دقیقاً مثل نسخه Prisma.
 */
export function createFakeSellerProductsRepository() {
  const sellers: { id: string; userId: string; status: string }[] = [];
  const categories = new Map<string, boolean>();
  const products: ProductWithRelations[] = [];
  let seq = 0;
  // شناسه محصول باید UUID معتبر باشد (productIdParamSchema)؛ بقیه شناسه‌ها قالب ساده دارند
  const nextId = (prefix: string) =>
    prefix === "prod"
      ? `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`
      : `${prefix}-${String(++seq).padStart(4, "0")}`;

  const assertSlugFree = (slug: string, exceptId?: string) => {
    if (products.some((p) => p.slug === slug && p.id !== exceptId)) {
      throw new ConflictError(SLUG_TAKEN_MESSAGE, { slug: [SLUG_TAKEN_MESSAGE] });
    }
  };

  const buildImages = (productId: string, images: { url: string; altText?: string | undefined }[]) =>
    images.map((image, position) => ({
      id: nextId("img"),
      productId,
      url: image.url,
      altText: image.altText ?? null,
      position,
    }));

  const repository: ProductsRepository = {
    async findSellerByUserId(userId) {
      const seller = sellers.find((s) => s.userId === userId);
      return seller ? { id: seller.id, status: seller.status } : null;
    },
    async categoryIsActive(categoryId) {
      return categories.get(categoryId) === true;
    },
    async slugExists(slug) {
      return products.some((p) => p.slug === slug);
    },
    async createWithVariants(data: CreateProductData) {
      assertSlugFree(data.slug);
      const id = nextId("prod");
      const now = new Date();
      const product = {
        id,
        sellerId: data.sellerId,
        categoryId: data.categoryId,
        title: data.title,
        slug: data.slug,
        description: data.description,
        basePrice: data.basePrice,
        compareAtPrice: data.compareAtPrice ?? null,
        status: "DRAFT" as Status,
        createdAt: now,
        updatedAt: now,
        variants: data.variants.map((v, index) => ({
          id: nextId("var"),
          productId: id,
          sku: `SKU-${id}-${index}`,
          size: v.size,
          color: v.color,
          price: v.price ?? null,
          stock: v.stock,
          createdAt: now,
          updatedAt: now,
        })),
        images: buildImages(id, data.images),
      } as unknown as ProductWithRelations;
      products.push(product);
      return product;
    },
    async findOwnedById(sellerId, productId) {
      return products.find((p) => p.id === productId && p.sellerId === sellerId) ?? null;
    },
    async findManyForSeller(sellerId, { page, limit, status, q }) {
      const filtered = products
        .filter((p) => p.sellerId === sellerId)
        .filter((p) => (status ? p.status === status : true))
        .filter((p) => (q ? p.title.toLowerCase().includes(q.toLowerCase()) : true));
      return { items: filtered.slice((page - 1) * limit, page * limit), total: filtered.length };
    },
    async updateFields(productId, patch: UpdateProductFields) {
      const product = products.find((p) => p.id === productId);
      if (!product) throw new Error("fake: product not found");
      if (patch.slug !== undefined) assertSlugFree(patch.slug, productId);
      const mutable = product as unknown as Record<string, unknown>;
      for (const key of ["categoryId", "title", "slug", "description", "basePrice"] as const) {
        if (patch[key] !== undefined) mutable[key] = patch[key];
      }
      if (patch.compareAtPrice !== undefined) mutable.compareAtPrice = patch.compareAtPrice;
      if (patch.images !== undefined) mutable.images = buildImages(productId, patch.images);
      mutable.updatedAt = new Date();
      return product;
    },
    async updateStatus(productId, status) {
      const product = products.find((p) => p.id === productId);
      if (!product) throw new Error("fake: product not found");
      (product as unknown as { status: Status }).status = status;
      return product;
    },
  };

  return {
    repository,
    products,
    addSeller(userId: string, status: string) {
      const id = nextId("seller");
      sellers.push({ id, userId, status });
      return id;
    },
    addCategory(id: string, active = true) {
      categories.set(id, active);
    },
    /** قیمت ثابت/وضعیت دلخواه؛ برای ساخت داده اولیه بدون عبور از API */
    async seedProduct(
      sellerId: string,
      overrides: Partial<{ title: string; slug: string; categoryId: string; status: Status; variants: number }> = {},
    ) {
      const created = await repository.createWithVariants(
        {
          sellerId,
          categoryId: overrides.categoryId ?? DEFAULT_CATEGORY,
          title: overrides.title ?? "کت پشمی",
          slug: overrides.slug ?? `seed-${nextId("s")}`,
          description: "توضیحات کامل محصول برای تست",
          basePrice: 1_000_000,
          variants: Array.from({ length: overrides.variants ?? 1 }, (_, i) => ({
            size: `S${i}`,
            color: "مشکی",
            stock: 5,
          })),
          images: [],
        },
        "seed",
      );
      if (overrides.status) await repository.updateStatus(created.id, overrides.status);
      return created.id;
    },
  };
}
