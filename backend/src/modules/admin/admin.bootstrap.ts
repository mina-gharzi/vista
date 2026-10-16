import { ValidationError } from "../../errors/AppError";

/**
 * راه‌اندازی اولین ادمین: «فقط» از طریق اسکریپت سمت سرور (prisma/createAdmin.ts) با دسترسی به
 * دیتابیس و متغیرهای محیطی. هیچ Endpoint عمومی برای ساخت/ارتقای ادمین وجود ندارد.
 */
export interface BootstrapStore {
  findUserByEmail(email: string): Promise<{ id: string; role: string } | null>;
  createAdmin(data: { email: string; fullName: string; passwordHash: string }): Promise<void>;
  promoteToAdmin(userId: string): Promise<void>;
}

export interface BootstrapInput {
  email: string;
  password?: string | undefined;
  fullName?: string | undefined;
}

export type BootstrapResult = "created" | "promoted" | "already_admin";

const MIN_PASSWORD_LENGTH = 12;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function bootstrapAdmin(
  store: BootstrapStore,
  input: BootstrapInput,
  hashPassword: (password: string) => Promise<string>,
): Promise<BootstrapResult> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new ValidationError("ایمیل معتبر نیست");

  const existing = await store.findUserByEmail(email);
  if (existing) {
    // ارتقای کاربر موجود (رمز او دست نمی‌خورد)
    if (existing.role === "ADMIN") return "already_admin";
    await store.promoteToAdmin(existing.id);
    return "promoted";
  }

  if (!input.password || input.password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`رمز عبور ادمین باید حداقل ${MIN_PASSWORD_LENGTH} کاراکتر باشد`);
  }
  await store.createAdmin({
    email,
    fullName: input.fullName?.trim() || "مدیر سیستم",
    passwordHash: await hashPassword(input.password),
  });
  return "created";
}
