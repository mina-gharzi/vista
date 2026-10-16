import { PrismaClient } from "@prisma/client";
import { bootstrapAdmin } from "../src/modules/admin/admin.bootstrap";
import { hashPassword } from "../src/utils/password";

/**
 * ساخت/ارتقای ادمین — فقط با دسترسی سرور به دیتابیس. مقادیر از «متغیر محیطی» خوانده می‌شود
 * (نه آرگومان خط فرمان) تا رمز در History شل نماند:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... [ADMIN_FULL_NAME=...] npx tsx prisma/createAdmin.ts
 * اگر ایمیل از قبل کاربر باشد فقط نقشش ADMIN می‌شود و رمزش تغییر نمی‌کند.
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  if (!email) throw new Error("ADMIN_EMAIL الزامی است");

  const result = await bootstrapAdmin(
    {
      findUserByEmail: (value) =>
        prisma.user.findUnique({ where: { email: value }, select: { id: true, role: true } }),
      createAdmin: async (data) => {
        await prisma.user.create({ data: { ...data, role: "ADMIN" } });
      },
      promoteToAdmin: async (userId) => {
        await prisma.user.update({ where: { id: userId }, data: { role: "ADMIN" } });
      },
    },
    {
      email,
      password: process.env.ADMIN_PASSWORD,
      fullName: process.env.ADMIN_FULL_NAME,
    },
    hashPassword,
  );
  // eslint-disable-next-line no-console
  console.log(`ادمین: ${result}`);
}

main()
  .catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
