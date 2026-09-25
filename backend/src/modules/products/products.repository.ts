import type { Prisma, PrismaClient } from "@prisma/client";
import type { ProductStatus } from "@vista/shared";

export interface VariantInput {
  size: string;
  color: string;
  price?: number | undefined;
  stock: number;
}

export interface ImageInput {
  url: string;
  altText?: string | undefined;
}

export interface CreateProductData {
  sellerId: string;
  categoryId: string;
  title: string;
  slug: string;
  description: string;
  basePrice: number;
  compareAtPrice?: number | undefined;
  variants: VariantInput[];
  images: ImageInput[];
}

export interface UpdateProductFields {
  categoryId?: string | undefined;
  title?: string | undefined;
  description?: string | undefined;
  basePrice?: number | undefined;
  compareAtPrice?: number | null | undefined;
}

// include باید در محل هر Query به‌صورت Literal نوشته شود (نه از یک Object جدا Spread شود)
// چون Prisma نوع دقیق Payload (شامل variants/images) را فقط این‌طور Infer می‌کند.
const PRODUCT_INCLUDE = {
  variants: true,
  images: { orderBy: { position: "asc" as const } },
} as const;

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: { variants: true; images: true };
}>;

export interface ProductsRepository {
  /** برای گارد Authorization در Service: آیا این کاربر یک حساب فروشندگی دارد و وضعیت آن؟ */
  findSellerByUserId(userId: string): Promise<{ id: string; status: string } | null>;
  categoryIsActive(categoryId: string): Promise<boolean>;
  slugExists(slug: string): Promise<boolean>;
  /** ساخت محصول + Variantها + تصاویر + ثبت InventoryMovement اولیه، همه در یک Transaction */
  createWithVariants(data: CreateProductData, actorUserId: string): Promise<ProductWithRelations>;
  findOwnedById(sellerId: string, productId: string): Promise<ProductWithRelations | null>;
  findManyForSeller(
    sellerId: string,
    params: { page: number; limit: number; status?: ProductStatus | undefined },
  ): Promise<{ items: ProductWithRelations[]; total: number }>;
  updateFields(productId: string, patch: UpdateProductFields): Promise<ProductWithRelations>;
  updateStatus(productId: string, status: ProductStatus): Promise<ProductWithRelations>;
}

export function createProductsRepository(prisma: PrismaClient): ProductsRepository {
  return {
    async findSellerByUserId(userId) {
      return prisma.seller.findUnique({ where: { userId }, select: { id: true, status: true } });
    },

    async categoryIsActive(categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
        select: { isActive: true },
      });
      return category?.isActive ?? false;
    },

    async slugExists(slug) {
      const existing = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
      return existing !== null;
    },

    async createWithVariants(data, actorUserId) {
      return prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            sellerId: data.sellerId,
            categoryId: data.categoryId,
            title: data.title,
            slug: data.slug,
            description: data.description,
            basePrice: data.basePrice,
            compareAtPrice: data.compareAtPrice ?? null,
            variants: {
              create: data.variants.map((variant) => ({
                sku: generateSku(),
                size: variant.size,
                color: variant.color,
                price: variant.price ?? null,
                stock: variant.stock,
              })),
            },
            images: {
              create: data.images.map((image, index) => ({
                url: image.url,
                altText: image.altText ?? null,
                position: index,
              })),
            },
          },
          include: PRODUCT_INCLUDE,
        });

        // موجودی اولیه هر Variant در دفتر کل انبار ثبت می‌شود (بخش ۸ ARCHITECTURE.md)
        if (product.variants.length > 0) {
          await tx.inventoryMovement.createMany({
            data: product.variants.map((variant) => ({
              variantId: variant.id,
              type: "INITIAL",
              quantityDelta: variant.stock,
              stockAfter: variant.stock,
              actorId: actorUserId,
            })),
          });
        }

        return product;
      });
    },

    async findOwnedById(sellerId, productId) {
      return prisma.product.findFirst({
        where: { id: productId, sellerId },
        include: PRODUCT_INCLUDE,
      });
    },

    async findManyForSeller(sellerId, { page, limit, status }) {
      const where: Prisma.ProductWhereInput = { sellerId, ...(status ? { status } : {}) };
      const [items, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: PRODUCT_INCLUDE,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.product.count({ where }),
      ]);
      return { items, total };
    },

    async updateFields(productId, patch) {
      // فیلد به فیلد ساخته می‌شود (نه Spread) چون exactOptionalPropertyTypes با کلیدهای
      // اختیاری Prisma روی Object از پیش‌ساخته سازگار نیست؛ categoryId هم FK است، از طریق "connect"
      const data: Prisma.ProductUpdateInput = {};
      if (patch.categoryId !== undefined) data.category = { connect: { id: patch.categoryId } };
      if (patch.title !== undefined) data.title = patch.title;
      if (patch.description !== undefined) data.description = patch.description;
      if (patch.basePrice !== undefined) data.basePrice = patch.basePrice;
      if (patch.compareAtPrice !== undefined) data.compareAtPrice = patch.compareAtPrice;

      return prisma.product.update({ where: { id: productId }, data, include: PRODUCT_INCLUDE });
    },

    async updateStatus(productId, status) {
      return prisma.product.update({
        where: { id: productId },
        data: { status },
        include: PRODUCT_INCLUDE,
      });
    },
  };
}

/** SKU خوانا و به‌اندازه‌کافی یکتا: VST- + ۸ کاراکتر Base36 از زمان+تصادفی */
function generateSku(): string {
  const random = Math.random().toString(36).slice(2, 6);
  const time = Date.now().toString(36).slice(-4);
  return `VST-${time}${random}`.toUpperCase();
}
