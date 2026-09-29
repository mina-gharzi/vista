import type { WishlistItemSummary } from "@vista/shared";
import { NotFoundError } from "../../errors/AppError";
import type { WishlistRepository } from "./wishlist.repository";
import { toWishlistItem } from "./wishlist.mapper";

export interface WishlistService {
  list(userId: string): Promise<WishlistItemSummary[]>;
  getStatus(userId: string, productId: string): Promise<{ isWishlisted: boolean }>;
  add(userId: string, productId: string): Promise<WishlistItemSummary[]>;
  remove(userId: string, productId: string): Promise<WishlistItemSummary[]>;
}

export function createWishlistService(repository: WishlistRepository): WishlistService {
  return {
    async list(userId) {
      return (await repository.findAllForUser(userId)).map(toWishlistItem);
    },

    async getStatus(userId, productId) {
      return { isWishlisted: await repository.isWishlisted(userId, productId) };
    },

    async add(userId, productId) {
      if (!(await repository.productExists(productId))) {
        throw new NotFoundError("محصول یافت نشد");
      }
      await repository.add(userId, productId);
      return (await repository.findAllForUser(userId)).map(toWishlistItem);
    },

    async remove(userId, productId) {
      await repository.remove(userId, productId);
      return (await repository.findAllForUser(userId)).map(toWishlistItem);
    },
  };
}
