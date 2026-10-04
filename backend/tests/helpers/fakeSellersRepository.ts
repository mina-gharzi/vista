import type { SellerStatus, UserRole } from "@vista/shared";
import { ConflictError } from "../../src/errors/AppError";
import {
  DUPLICATE_APPLICATION_MESSAGE,
  SLUG_TAKEN_MESSAGE,
  type SellerApplicationData,
  type SellerRecord,
  type SellersRepository,
} from "../../src/modules/sellers/sellers.repository";

interface StoredSeller extends SellerRecord {
  userId: string;
}

/** Repository درون‌حافظه‌ای با همان قراردادهای Unique دیتابیس (userId و storeSlug یکتا). */
export function createFakeSellersRepository() {
  const users = new Map<string, UserRole>();
  const sellers = new Map<string, StoredSeller>();
  let clock = 0;
  const tick = () => new Date(Date.UTC(2026, 0, 1, 0, 0, clock++));

  const slugOwner = (slug: string) => [...sellers.values()].find((s) => s.storeSlug === slug);
  const strip = ({ userId: _userId, ...record }: StoredSeller): SellerRecord => record;

  const repository: SellersRepository = {
    async findUserRole(userId) {
      return users.get(userId) ?? null;
    },
    async findByUserId(userId) {
      const found = sellers.get(userId);
      return found ? strip(found) : null;
    },
    async isSlugTakenByOther(storeSlug, userId) {
      const owner = slugOwner(storeSlug);
      return owner !== undefined && owner.userId !== userId;
    },
    async createPending(userId, data: SellerApplicationData) {
      // شبیه‌سازی نقض Unique دیتابیس (Race که از بررسی Service رد شده)
      if (sellers.has(userId)) throw new ConflictError(DUPLICATE_APPLICATION_MESSAGE);
      if (slugOwner(data.storeSlug)) {
        throw new ConflictError(SLUG_TAKEN_MESSAGE, { storeSlug: [SLUG_TAKEN_MESSAGE] });
      }
      const now = tick();
      const stored: StoredSeller = { userId, ...data, status: "PENDING", createdAt: now, updatedAt: now };
      sellers.set(userId, stored);
      return strip(stored);
    },
    async resubmitRejected(userId, data) {
      const current = sellers.get(userId);
      if (!current || current.status !== "REJECTED") return null;
      const owner = slugOwner(data.storeSlug);
      if (owner && owner.userId !== userId) {
        throw new ConflictError(SLUG_TAKEN_MESSAGE, { storeSlug: [SLUG_TAKEN_MESSAGE] });
      }
      const updated: StoredSeller = { ...current, ...data, status: "PENDING", updatedAt: tick() };
      sellers.set(userId, updated);
      return strip(updated);
    },
  };

  return {
    repository,
    addUser(id: string, role: UserRole = "CUSTOMER") {
      users.set(id, role);
    },
    seedSeller(userId: string, status: SellerStatus, storeSlug: string, storeName = "فروشگاه") {
      const now = tick();
      sellers.set(userId, {
        userId,
        storeName,
        storeSlug,
        description: null,
        status,
        createdAt: now,
        updatedAt: now,
      });
    },
    getStored(userId: string) {
      return sellers.get(userId);
    },
    count: () => sellers.size,
  };
}