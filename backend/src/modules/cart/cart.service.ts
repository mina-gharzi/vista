import type { CartSummary } from "@vista/shared";
import { ConflictError, NotFoundError, ValidationError } from "../../errors/AppError";
import type { CartRepository } from "./cart.repository";
import { toCartSummary } from "./cart.mapper";

async function requirePurchasableVariant(repository: CartRepository, variantId: string) {
  const variant = await repository.findVariantForCart(variantId);
  if (!variant || variant.isActive === false || variant.product.status !== "PUBLISHED") {
    throw new NotFoundError("این کالا در دسترس نیست");
  }
  return variant;
}

export interface CartService {
  getCart(userId: string): Promise<CartSummary>;
  addItem(userId: string, variantId: string, quantity: number): Promise<CartSummary>;
  updateItemQuantity(userId: string, variantId: string, quantity: number): Promise<CartSummary>;
  removeItem(userId: string, variantId: string): Promise<CartSummary>;
}

export function createCartService(repository: CartRepository): CartService {
  return {
    async getCart(userId) {
      return toCartSummary(await repository.getItems(userId));
    },

    async addItem(userId, variantId, quantity) {
      const variant = await requirePurchasableVariant(repository, variantId);

      // اگر همین Variant قبلاً در سبد باشد، تعداد جدید روی تعداد فعلی جمع می‌شود
      const currentQuantity = await repository.getItemQuantity(userId, variantId);
      const nextQuantity = currentQuantity + quantity;

      if (nextQuantity > variant.stock) {
        throw new ConflictError(
          currentQuantity > 0
            ? `موجودی کافی نیست — ${currentQuantity} عدد از این کالا در سبد شماست و حداکثر ${variant.stock} عدد موجود است`
            : `موجودی کافی نیست — حداکثر ${variant.stock} عدد موجود است`,
        );
      }

      await repository.upsertItem(userId, variantId, nextQuantity);
      return toCartSummary(await repository.getItems(userId));
    },

    async updateItemQuantity(userId, variantId, quantity) {
      const currentQuantity = await repository.getItemQuantity(userId, variantId);
      if (currentQuantity === 0) {
        throw new NotFoundError("این کالا در سبد خرید شما نیست");
      }

      const variant = await requirePurchasableVariant(repository, variantId);
      if (quantity > variant.stock) {
        throw new ValidationError("موجودی کافی نیست", {
          quantity: [`حداکثر ${variant.stock} عدد موجود است`],
        });
      }

      await repository.upsertItem(userId, variantId, quantity);
      return toCartSummary(await repository.getItems(userId));
    },

    async removeItem(userId, variantId) {
      await repository.removeItem(userId, variantId);
      return toCartSummary(await repository.getItems(userId));
    },
  };
}
