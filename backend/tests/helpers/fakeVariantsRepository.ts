import { ConflictError } from "../../src/errors/AppError";
import {
  COMBINATION_TAKEN_MESSAGE,
  SKU_TAKEN_MESSAGE,
  type OwnedProductRow,
  type VariantRow,
  type VariantsRepository,
} from "../../src/modules/variants/variants.repository";

type ProductStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

/**
 * Repository درون‌حافظه‌ای با همان قرارداد Repository واقعی (از جمله قیود یکتایی sku و ترکیب رنگ/سایز).
 * داده چند فروشنده همزمان نگه داشته می‌شود تا نشت بین فروشندگان قابل تست باشد.
 */
export function createFakeVariantsRepository() {
  const sellers: { id: string; userId: string; status: string }[] = [];
  const products: (OwnedProductRow & { sellerId: string })[] = [];
  const variants: VariantRow[] = [];
  const movements: { variantId: string; type: string; quantityDelta: number; actorId: string }[] = [];
  let seq = 0;
  // شناسه‌ها باید UUID معتبر باشند (اعتبارسنجی پارامتر مسیر)
  const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
  const keyOf = (v: { size: string; color: string }) =>
    `${v.size.trim().toLowerCase()}::${v.color.trim().toLowerCase()}`;

  const repository: VariantsRepository = {
    async findSellerByUserId(userId) {
      const seller = sellers.find((s) => s.userId === userId);
      return seller ? { id: seller.id, status: seller.status } : null;
    },
    async findOwnedProduct(sellerId, productId) {
      const product = products.find((p) => p.id === productId && p.sellerId === sellerId);
      return product ? { id: product.id, status: product.status, basePrice: product.basePrice } : null;
    },
    async listByProduct(productId) {
      return variants.filter((v) => v.productId === productId).map((v) => ({ ...v }));
    },
    async skuExists(sku) {
      return variants.some((v) => v.sku === sku);
    },
    async create(productId, data, actorUserId) {
      if (variants.some((v) => v.sku === data.sku)) {
        throw new ConflictError(SKU_TAKEN_MESSAGE, { sku: [SKU_TAKEN_MESSAGE] });
      }
      if (variants.some((v) => v.productId === productId && keyOf(v) === keyOf(data))) {
        throw new ConflictError(COMBINATION_TAKEN_MESSAGE, { color: [COMBINATION_TAKEN_MESSAGE] });
      }
      const row: VariantRow = { id: uuid(), productId, ...data, isActive: true };
      variants.push(row);
      movements.push({ variantId: row.id, type: "INITIAL", quantityDelta: data.stock, actorId: actorUserId });
      return { ...row };
    },
    async update(variantId, patch) {
      const row = variants.find((v) => v.id === variantId);
      if (!row) throw new Error("fake: variant not found");
      if (patch.sku !== undefined && variants.some((v) => v.id !== variantId && v.sku === patch.sku)) {
        throw new ConflictError(SKU_TAKEN_MESSAGE, { sku: [SKU_TAKEN_MESSAGE] });
      }
      const next = { size: patch.size ?? row.size, color: patch.color ?? row.color };
      if (variants.some((v) => v.id !== variantId && v.productId === row.productId && keyOf(v) === keyOf(next))) {
        throw new ConflictError(COMBINATION_TAKEN_MESSAGE, { color: [COMBINATION_TAKEN_MESSAGE] });
      }
      if (patch.size !== undefined) row.size = patch.size;
      if (patch.color !== undefined) row.color = patch.color;
      if (patch.sku !== undefined) row.sku = patch.sku;
      if (patch.price !== undefined) row.price = patch.price;
      if (patch.isActive !== undefined) row.isActive = patch.isActive;
      return { ...row };
    },
    async transaction(work) {
      // سرویس همه اعتبارسنجی را قبل از نوشتن انجام می‌دهد؛ برای تست نیازی به Rollback نیست
      return work(repository);
    },
  };

  return {
    repository,
    variants,
    movements,
    addSeller(userId: string, status: string) {
      const id = uuid();
      sellers.push({ id, userId, status });
      return id;
    },
    addProduct(sellerId: string, status: ProductStatus = "DRAFT", basePrice = 1_000_000) {
      const id = uuid();
      products.push({ id, sellerId, status, basePrice });
      return id;
    },
    addVariant(
      productId: string,
      data: { size: string; color: string; sku: string; price?: number | null; stock?: number; isActive?: boolean },
    ) {
      const row: VariantRow = {
        id: uuid(),
        productId,
        size: data.size,
        color: data.color,
        sku: data.sku,
        price: data.price ?? null,
        stock: data.stock ?? 0,
        isActive: data.isActive ?? true,
      };
      variants.push(row);
      return row.id;
    },
  };
}
