import {
  getEffectivePrice,
  variantCombinationKey,
  type CreateVariantInput,
  type ProductVariantSummary,
  type SyncVariantsInput,
  type UpdateVariantInput,
} from "@vista/shared";
import { randomBytes } from "node:crypto";
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
} from "../../errors/AppError";
import {
  COMBINATION_TAKEN_MESSAGE,
  SKU_TAKEN_MESSAGE,
  type OwnedProductRow,
  type VariantRow,
  type VariantsRepository,
} from "./variants.repository";

const MAX_SKU_ATTEMPTS = 5;

export function toVariantSummary(row: VariantRow): ProductVariantSummary {
  return {
    id: row.id,
    sku: row.sku,
    size: row.size,
    color: row.color,
    price: row.price,
    stock: row.stock,
    isActive: row.isActive,
  };
}

const skuTaken = () => new ConflictError(SKU_TAKEN_MESSAGE, { sku: [SKU_TAKEN_MESSAGE] });
const combinationTaken = () =>
  new ConflictError(COMBINATION_TAKEN_MESSAGE, { color: [COMBINATION_TAKEN_MESSAGE] });

async function requireApprovedSeller(repository: VariantsRepository, userId: string): Promise<string> {
  const seller = await repository.findSellerByUserId(userId);
  if (!seller) {
    throw new AuthorizationError("برای مدیریت محصول ابتدا باید حساب فروشندگی ایجاد کنید");
  }
  if (seller.status === "SUSPENDED") throw new AuthorizationError("حساب فروشندگی شما مسدود شده است");
  if (seller.status !== "APPROVED") {
    throw new AuthorizationError("حساب فروشندگی شما هنوز تأیید نشده است");
  }
  return seller.id;
}

/** برای فروشنده دیگر همیشه 404 (نه 403) تا وجود محصول فاش نشود */
async function requireOwnedProduct(
  repository: VariantsRepository,
  sellerId: string,
  productId: string,
): Promise<OwnedProductRow> {
  const product = await repository.findOwnedProduct(sellerId, productId);
  if (!product) throw new NotFoundError("محصول یافت نشد");
  return product;
}

function assertEditable(product: OwnedProductRow): void {
  if (product.status === "ARCHIVED") {
    throw new ConflictError("محصول آرشیوشده قابل ویرایش نیست");
  }
}

function assertKeepsActiveVariant(product: OwnedProductRow, remainingActive: number): void {
  if (product.status === "PUBLISHED" && remainingActive === 0) {
    throw new ConflictError(
      "محصول منتشرشده باید حداقل یک تنوع فعال داشته باشد؛ ابتدا انتشار محصول را لغو کنید",
      { variants: ["حداقل یک تنوع فعال لازم است"] },
    );
  }
}

/** SKU خوانا و یکتا؛ در صورت برخورد چند بار تلاش می‌شود */
async function generateSku(repository: VariantsRepository): Promise<string> {
  for (let attempt = 0; attempt < MAX_SKU_ATTEMPTS; attempt += 1) {
    const candidate = `VST-${randomBytes(4).toString("hex").toUpperCase()}`;
    if (!(await repository.skuExists(candidate))) return candidate;
  }
  throw new ConflictError("ساخت SKU یکتا ممکن نشد؛ دوباره تلاش کنید");
}

export interface VariantsService {
  assertCanManage(userId: string): Promise<void>;
  list(userId: string, productId: string): Promise<ProductVariantSummary[]>;
  create(userId: string, productId: string, input: CreateVariantInput): Promise<ProductVariantSummary>;
  update(
    userId: string,
    productId: string,
    variantId: string,
    input: UpdateVariantInput,
  ): Promise<ProductVariantSummary>;
  archive(userId: string, productId: string, variantId: string): Promise<ProductVariantSummary>;
  sync(userId: string, productId: string, input: SyncVariantsInput): Promise<ProductVariantSummary[]>;
}

export function createVariantsService(repository: VariantsRepository): VariantsService {
  return {
    async assertCanManage(userId) {
      await requireApprovedSeller(repository, userId);
    },

    async list(userId, productId) {
      const sellerId = await requireApprovedSeller(repository, userId);
      await requireOwnedProduct(repository, sellerId, productId);
      return (await repository.listByProduct(productId)).map(toVariantSummary);
    },

    async create(userId, productId, input) {
      const sellerId = await requireApprovedSeller(repository, userId);
      const product = await requireOwnedProduct(repository, sellerId, productId);
      assertEditable(product);

      return repository.transaction(async (repo) => {
        const existing = await repo.listByProduct(productId);
        const key = variantCombinationKey(input);
        const sameCombination = existing.find((variant) => variantCombinationKey(variant) === key);

        if (sameCombination?.isActive) throw combinationTaken();

        if (input.sku && input.sku !== sameCombination?.sku && (await repo.skuExists(input.sku))) {
          throw skuTaken();
        }

        // ترکیب قبلاً آرشیو شده: همان رکورد (با تاریخچه‌اش) دوباره فعال می‌شود؛ موجودی دست نمی‌خورد
        if (sameCombination) {
          const revived = await repo.update(sameCombination.id, {
            size: input.size,
            color: input.color,
            ...(input.sku ? { sku: input.sku } : {}),
            price: input.price ?? null,
            isActive: true,
          });
          return toVariantSummary(revived);
        }

        const created = await repo.create(
          productId,
          {
            size: input.size,
            color: input.color,
            sku: input.sku ?? (await generateSku(repo)),
            price: input.price ?? null,
            stock: input.stock,
          },
          userId,
        );
        return toVariantSummary(created);
      });
    },

    async update(userId, productId, variantId, input) {
      const sellerId = await requireApprovedSeller(repository, userId);
      const product = await requireOwnedProduct(repository, sellerId, productId);
      assertEditable(product);

      return repository.transaction(async (repo) => {
        const existing = await repo.listByProduct(productId);
        // variantId فقط در محدوده تنوع‌های همین محصولِ متعلق به فروشنده جستجو می‌شود
        const current = existing.find((variant) => variant.id === variantId);
        if (!current) throw new NotFoundError("تنوع یافت نشد");
        if (!current.isActive) throw new ConflictError("تنوع آرشیوشده قابل ویرایش نیست");

        const next = { size: input.size ?? current.size, color: input.color ?? current.color };
        const key = variantCombinationKey(next);
        if (existing.some((v) => v.id !== variantId && variantCombinationKey(v) === key)) {
          throw combinationTaken();
        }
        if (input.sku && input.sku !== current.sku && (await repo.skuExists(input.sku))) {
          throw skuTaken();
        }

        return toVariantSummary(await repo.update(variantId, input));
      });
    },

    async archive(userId, productId, variantId) {
      const sellerId = await requireApprovedSeller(repository, userId);
      const product = await requireOwnedProduct(repository, sellerId, productId);
      assertEditable(product);

      return repository.transaction(async (repo) => {
        const existing = await repo.listByProduct(productId);
        const current = existing.find((variant) => variant.id === variantId);
        if (!current) throw new NotFoundError("تنوع یافت نشد");
        if (!current.isActive) return toVariantSummary(current); // Idempotent

        // حذف فیزیکی هرگز: سفارش‌ها (Restrict) و تاریخچه انبار به این ردیف وابسته‌اند
        const remaining = existing.filter((v) => v.isActive && v.id !== variantId).length;
        assertKeepsActiveVariant(product, remaining);
        return toVariantSummary(await repo.update(variantId, { isActive: false }));
      });
    },

    async sync(userId, productId, input) {
      const sellerId = await requireApprovedSeller(repository, userId);
      const product = await requireOwnedProduct(repository, sellerId, productId);
      assertEditable(product);

      return repository.transaction(async (repo) => {
        const existing = await repo.listByProduct(productId);
        const byId = new Map(existing.map((variant) => [variant.id, variant]));
        const byKey = new Map(existing.map((variant) => [variantCombinationKey(variant), variant]));

        interface Planned {
          target: VariantRow | null;
          item: SyncVariantsInput["variants"][number];
        }
        const planned: Planned[] = [];
        const claimed = new Set<string>();

        input.variants.forEach((item) => {
          let target: VariantRow | null = null;
          if (item.id) {
            target = byId.get(item.id) ?? null;
            if (!target) throw new NotFoundError("تنوع یافت نشد");
          } else {
            // بدون id ولی ترکیب موجود: همان رکورد استفاده می‌شود (ساخت رکورد تکراری ممنوع)
            target = byKey.get(variantCombinationKey(item)) ?? null;
          }
          if (target) {
            if (claimed.has(target.id)) throw combinationTaken();
            claimed.add(target.id);
          }
          planned.push({ target, item });
        });

        // ترکیب جدید یک تنوع ویرایش‌شده نباید با تنوعی که در این ذخیره دست‌نخورده می‌ماند یا فعال است برخورد کند
        const finalKeys = new Map<string, string>();
        for (const { target, item } of planned) {
          const key = variantCombinationKey(item);
          const owner = finalKeys.get(key);
          if (owner !== undefined) throw combinationTaken();
          finalKeys.set(key, target?.id ?? "new");
        }
        for (const variant of existing) {
          if (claimed.has(variant.id)) continue;
          const owner = finalKeys.get(variantCombinationKey(variant));
          // رکورد دست‌نخورده (حتی آرشیوشده) ترکیبش را در DB نگه می‌دارد؛ آیتم دیگری نمی‌تواند همان ترکیب را بگیرد
          if (owner !== undefined) throw combinationTaken();
        }

        const toArchive = existing.filter((variant) => variant.isActive && !claimed.has(variant.id));
        assertKeepsActiveVariant(product, planned.length);

        for (const { item, target } of planned) {
          if (item.sku && item.sku !== target?.sku && (await repo.skuExists(item.sku))) {
            throw skuTaken();
          }
        }

        for (const variant of toArchive) await repo.update(variant.id, { isActive: false });

        for (const { target, item } of planned) {
          if (target) {
            await repo.update(target.id, {
              size: item.size,
              color: item.color,
              ...(item.sku ? { sku: item.sku } : {}),
              price: item.price ?? null,
              isActive: true,
            });
          } else {
            await repo.create(
              productId,
              {
                size: item.size,
                color: item.color,
                sku: item.sku ?? (await generateSku(repo)),
                price: item.price ?? null,
                stock: item.stock,
              },
              userId,
            );
          }
        }

        return (await repo.listByProduct(productId)).map(toVariantSummary);
      });
    },
  };
}

export { getEffectivePrice };
