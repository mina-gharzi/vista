import { z } from "zod";
import "dotenv/config";
/**
 * تمام Environment Variableهای ضروری پروژه اینجا تعریف می‌شوند.
 * اگر مقداری ضروری در .env نباشد، اپلیکیشن با خطای واضح در Startup متوقف می‌شود
 * (به‌جای شکست خوردن نامشخص در وسط اجرا).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL الزامی است"),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET باید حداقل ۳۲ کاراکتر باشد"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET باید حداقل ۳۲ کاراکتر باشد"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(7),
  CORS_ORIGIN: z.string().min(1, "CORS_ORIGIN الزامی است"),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error("❌ Environment Variables نامعتبر هستند:");
    // eslint-disable-next-line no-console
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;
