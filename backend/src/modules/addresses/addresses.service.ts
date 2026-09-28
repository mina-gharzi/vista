import type { AddressInput, AddressSummary, UpdateAddressInput } from "@vista/shared";
import { NotFoundError } from "../../errors/AppError";
import type { AddressesRepository } from "./addresses.repository";

export interface AddressesService {
  list(userId: string): Promise<AddressSummary[]>;
  create(userId: string, input: AddressInput): Promise<AddressSummary>;
  update(userId: string, addressId: string, input: UpdateAddressInput): Promise<AddressSummary>;
  remove(userId: string, addressId: string): Promise<void>;
}

export function createAddressesService(repository: AddressesRepository): AddressesService {
  return {
    list(userId) {
      return repository.findAllForUser(userId);
    },

    async create(userId, input) {
      // اولین آدرس کاربر همیشه Default است، صرف‌نظر از مقدار ارسالی
      const isFirst = (await repository.countForUser(userId)) === 0;
      return repository.create(userId, { ...input, isDefault: isFirst || input.isDefault });
    },

    async update(userId, addressId, input) {
      const existing = await repository.findOwnedById(userId, addressId);
      if (!existing) {
        throw new NotFoundError("آدرس یافت نشد");
      }
      return repository.update(userId, addressId, input);
    },

    async remove(userId, addressId) {
      const existing = await repository.findOwnedById(userId, addressId);
      if (!existing) {
        throw new NotFoundError("آدرس یافت نشد");
      }
      await repository.remove(userId, addressId);
    },
  };
}
