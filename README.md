# VISTA — بازار آنلاین چندفروشنده مد

## شروع سریع

```bash
# نصب وابستگی‌ها (نیازمند pnpm)
pnpm install

# کپی Environment Variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# سپس مقادیر JWT_ACCESS_SECRET / JWT_REFRESH_SECRET / DATABASE_URL را در backend/.env تنظیم کنید

# اجرای Migration اولیه (نیازمند PostgreSQL در حال اجرا)
pnpm prisma:migrate

# اجرای همزمان بک‌اند و فرانت‌اند (در دو ترمینال جدا)
pnpm dev:backend
pnpm dev:frontend
```

بک‌اند روی `http://localhost:4000` و فرانت‌اند روی `http://localhost:3000` بالا می‌آید.

## مستندات معماری

قبل از افزودن هر Feature، حتماً **[ARCHITECTURE.md](./ARCHITECTURE.md)** را بخوانید.
این پروژه طبق یک پرامپت مادر با قوانین سخت‌گیرانه معماری، امنیت و کیفیت کد توسعه
داده می‌شود؛ هیچ Feature جدیدی نباید بدون در نظر گرفتن این مستند اضافه شود.

## وضعیت فعلی

اسکلت اولیه پروژه (Phase 0) کامل شده:
- ✅ ساختار Monorepo (`backend` / `frontend` / `shared`)
- ✅ Prisma Schema کامل (User, Seller, Product, Order, Cart, Wishlist, Review و ...)
- ✅ زیرساخت Backend: Error Handling مرکزی، Env Validation، Logger، Security Middlewareها
- ✅ Design System اولیه (Tailwind Tokens) + RTL + فونت Vazirmatn
- ✅ API Client متمرکز در Frontend
- ✅ Payment Interface انتزاعی + Mock Provider
- ⬜ هنوز هیچ Feature (Module) واقعی پیاده‌سازی نشده

**قدم بعدی پیشنهادی:** پیاده‌سازی Module کامل `auth` (ثبت‌نام/ورود/Refresh/Logout)
طبق پروتکل بخش ۴۰ ARCHITECTURE.md، چون بقیه Featureها به آن وابسته‌اند.
