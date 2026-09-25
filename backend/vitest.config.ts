import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // مقادیر آزمایشی — تست‌ها هرگز به Database یا Secret واقعی وابسته نیستند
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://test:test@localhost:5432/vista_test?schema=public",
      JWT_ACCESS_SECRET: "test_access_secret_min_32_chars_long_000",
      JWT_REFRESH_SECRET: "test_refresh_secret_min_32_chars_long_00",
      CORS_ORIGIN: "http://localhost:3000",
    },
  },
});
