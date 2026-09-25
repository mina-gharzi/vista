import { PrismaClient } from "@prisma/client";
import { env } from "../config/env";

/**
 * یک نمونه واحد PrismaClient در کل اپلیکیشن استفاده می‌شود.
 * تمام Repositoryها این فایل را Import می‌کنند و هرگز خودشان PrismaClient نمی‌سازند.
 */
export const prisma = new PrismaClient({
  log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
