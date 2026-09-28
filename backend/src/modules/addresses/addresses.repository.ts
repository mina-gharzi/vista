import type { Prisma, PrismaClient } from "@prisma/client";

export interface AddressRow {
  id: string;
  fullName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  addressLine: string;
  isDefault: boolean;
}

export interface AddressWriteData {
  fullName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  addressLine: string;
  isDefault: boolean;
}

const ADDRESS_SELECT = {
  id: true,
  fullName: true,
  phone: true,
  province: true,
  city: true,
  postalCode: true,
  addressLine: true,
  isDefault: true,
} as const;

export interface AddressUpdateData {
  fullName?: string | undefined;
  phone?: string | undefined;
  province?: string | undefined;
  city?: string | undefined;
  postalCode?: string | undefined;
  addressLine?: string | undefined;
  isDefault?: boolean | undefined;
}

export interface AddressesRepository {
  findAllForUser(userId: string): Promise<AddressRow[]>;
  findOwnedById(userId: string, addressId: string): Promise<AddressRow | null>;
  countForUser(userId: string): Promise<number>;
  /** اگر isDefault=true باشد، ابتدا default قبلی کاربر Unset می‌شود (همه در یک Transaction) */
  create(userId: string, data: AddressWriteData): Promise<AddressRow>;
  update(userId: string, addressId: string, data: AddressUpdateData): Promise<AddressRow>;
  remove(userId: string, addressId: string): Promise<void>;
}

export function createAddressesRepository(prisma: PrismaClient): AddressesRepository {
  return {
    async findAllForUser(userId) {
      return prisma.address.findMany({
        where: { userId },
        select: ADDRESS_SELECT,
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      });
    },

    async findOwnedById(userId, addressId) {
      return prisma.address.findFirst({ where: { id: addressId, userId }, select: ADDRESS_SELECT });
    },

    async countForUser(userId) {
      return prisma.address.count({ where: { userId } });
    },

    async create(userId, data) {
      return prisma.$transaction(async (tx) => {
        if (data.isDefault) {
          await tx.address.updateMany({
            where: { userId, isDefault: true },
            data: { isDefault: false },
          });
        }
        return tx.address.create({ data: { ...data, userId }, select: ADDRESS_SELECT });
      });
    },

    async update(userId, addressId, data) {
      return prisma.$transaction(async (tx) => {
        if (data.isDefault) {
          await tx.address.updateMany({
            where: { userId, isDefault: true, id: { not: addressId } },
            data: { isDefault: false },
          });
        }

        // فیلد به فیلد ساخته می‌شود چون exactOptionalPropertyTypes با Object از پیش‌ساخته سازگار نیست
        const patch: Prisma.AddressUpdateInput = {};
        if (data.fullName !== undefined) patch.fullName = data.fullName;
        if (data.phone !== undefined) patch.phone = data.phone;
        if (data.province !== undefined) patch.province = data.province;
        if (data.city !== undefined) patch.city = data.city;
        if (data.postalCode !== undefined) patch.postalCode = data.postalCode;
        if (data.addressLine !== undefined) patch.addressLine = data.addressLine;
        if (data.isDefault !== undefined) patch.isDefault = data.isDefault;

        return tx.address.update({ where: { id: addressId }, data: patch, select: ADDRESS_SELECT });
      });
    },

    async remove(userId, addressId) {
      await prisma.address.deleteMany({ where: { id: addressId, userId } });
    },
  };
}
