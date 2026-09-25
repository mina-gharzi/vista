# معماری پروژه VISTA (Multi-Vendor Fashion Marketplace)

این سند مرجع تصمیمات معماری پروژه است و باید قبل از افزودن هر Feature جدید مطالعه شود.
هیچ تصمیم معماری جدیدی نباید بدون به‌روزرسانی این سند گرفته شود.
(ارجاع‌ها به «پرامپت مادر» بر اساس شماره‌بندی نسخه فعلی آن است.)

---

## ۱. Tech Stack نهایی

| لایه | تکنولوژی | دلیل انتخاب |
|---|---|---|
| Frontend | Next.js 14 (App Router) + React + TypeScript | Server Components، SEO، Type Safety |
| Styling | Tailwind CSS + Design Tokens مرکزی | جلوگیری از Hard-code رنگ و Consistency |
| Backend | Node.js + Express.js + TypeScript | ساده، Layered، قابل تست |
| Database | PostgreSQL | Relational، مناسب Marketplace با Relationship زیاد |
| ORM | Prisma | Type Safety کامل بین DB و Backend، Migration ایمن |
| Validation | Zod | استفاده مشترک در Frontend و Backend (از طریق shared) |
| Auth | JWT (Access/Refresh) + Argon2 | استاندارد امن، Stateless برای Access Token |
| Package Manager | pnpm (Workspaces) | Monorepo سبک و سریع |
| کیفیت کد | ESLint 9 (Flat Config) + Prettier + Vitest | قوانین TypeScript، Accessibility (jsx-a11y)، تست |

## ۲. ساختار Repository

```text
vista/
├── backend/     → API سرور (Express + Prisma)
├── frontend/    → اپ Next.js
├── shared/      → Typeها و Zod Schemaهای مشترک (Build می‌شود به dist/)
├── eslint.config.mjs   → یک Config مشترک برای هر سه پکیج
├── ARCHITECTURE.md
└── package.json
```

### پکیج `shared`
`shared` به JavaScript (CommonJS) + فایل `.d.ts` کامپایل می‌شود (`shared/dist`) و Backend و Frontend
از خروجی Build شده آن استفاده می‌کنند. بنابراین:
- بعد از `pnpm install` به‌صورت خودکار Build می‌شود (اسکریپت `postinstall` ریشه).
- هنگام تغییر فایل‌های `shared` در حال توسعه، `pnpm dev:shared` (حالت watch) اجرا شود.

## ۳. جریان لایه‌ها (Backend)

```text
Route → Controller → Service → Repository → Prisma → PostgreSQL
                         ↑
                    Validator (Zod) قبل از ورود به Controller اجرا می‌شود
```

ساختار فایل‌ها **Feature-based** است (تصمیم نهایی؛ پوشه‌های تخت `controllers/`، `services/` و ... حذف شدند):

```text
backend/src/
├── modules/<feature>/
│   ├── <feature>.routes.ts
│   ├── <feature>.controller.ts
│   ├── <feature>.service.ts
│   ├── <feature>.repository.ts
│   └── <feature>.validator.ts
├── middlewares/   → errorHandler، validate، (بعداً) requireAuth، requireRole
├── errors/        → AppError (تنها سلسله‌مراتب خطا) + zod.ts
├── config/        → env.ts (اعتبارسنجی Environment با Zod)
├── db/            → prisma.ts (تنها PrismaClient)
├── payment/       → PaymentProvider (Interface) + MockPaymentProvider
├── utils/ ، types/
├── app.ts ، server.ts
```

مسئولیت هر لایه **نباید نقض شود**:
- Route: فقط تعریف مسیر و اتصال Middleware/Validator/Controller
- Controller: فقط دریافت Request معتبر → فراخوانی Service → ساخت Response
- Service: تمام Business Logic، هماهنگی چند Repository، محاسبات، Transaction
- Repository: تنها لایه‌ای که مستقیم با Prisma/Database کار می‌کند

### Error Handling
`throw new AppError(...)` (یا زیرکلاس‌هایش) → `errorHandler` مرکزی → پاسخ استاندارد `ApiErrorResponse`.
`errorHandler` این موارد را هم به خطای درست تبدیل می‌کند: `ZodError` (400)، JSON خراب (400)،
Body بزرگ‌تر از حد مجاز (413). خطای ناشناخته فقط Log می‌شود و جزئیاتش به Client نمی‌رسد.

## ۴. احراز هویت (Authentication Flow)

Endpointها (`/api/auth`): `POST register`، `POST login`، `POST refresh`، `POST logout`، `GET me`.

- **Access Token (JWT, HS256):** عمر ۱۵ دقیقه، شامل `sub` (userId) و `role`، با `issuer` و `algorithms` صریح Verify می‌شود.
  در Body پاسخ برمی‌گردد و Frontend آن را فقط در Memory نگه می‌دارد (نه localStorage).
- **Refresh Token:** رشته تصادفی مبهم (۳۲ بایت CSPRNG)، نه JWT. در httpOnly + Secure(در Production) + `SameSite=Strict` Cookie با
  `Path=/api/auth` ارسال می‌شود. در Database فقط `HMAC-SHA256(token, JWT_REFRESH_SECRET)` ذخیره می‌شود.
- **Rotation:** هر Refresh توکن قدیمی را (اتمیک، در Transaction) Revoke و توکن جدید صادر می‌کند.
- **Reuse Detection:** ارائه توکن Revoke‌شده بعد از بازه Race (۱۰ ثانیه) یعنی احتمال سرقت → تمام نشست‌های کاربر باطل می‌شود.
- **Logout:** Idempotent؛ توکن را Revoke و Cookie را پاک می‌کند.
- **Password:** Argon2id (m=19MiB, t=2, p=1)، سقف ۱۲۸ کاراکتر. Login با هش ساختگی زمان پاسخ را یکسان می‌کند (ضد User Enumeration).
- **CSRF:** `SameSite=Strict` + بررسی هدر `Origin` روی Refresh/Logout (`requireTrustedOrigin`).
- **Rate Limit:** Register/Login حداکثر ۱۰ درخواست در ۱۵ دقیقه به‌ازای IP؛ Refresh ۶۰ درخواست.
- **محدودیت‌های شناخته‌شده:** تغییر نقش کاربر تا انقضای Access Token (حداکثر ۱۵ دقیقه) اعمال نمی‌شود؛ پاک‌سازی
  RefreshTokenهای منقضی (Job دوره‌ای) هنوز پیاده نشده است؛ Rate Limit مبتنی بر IP است و پشت Proxy نیازمند `trust proxy` است.
- **Frontend:** Access Token فقط در حافظه (`lib/auth/tokenStore.ts`). `apiRequest` با گزینه `auth: true` هنگام 401 یک‌بار
  Session را تمدید و درخواست را تکرار می‌کند؛ Refreshهای همزمان Single-flight هستند (`lib/auth/session.ts`).
  `AuthProvider` هنگام بارگذاری نشست را با Refresh Cookie بازیابی می‌کند. `RequireAuth`/`GuestOnly` فقط UX هستند و
  مرجع Authorization همیشه Backend است. پارامتر `next` با `safeRedirectPath` (ضد Open Redirect) پاک‌سازی می‌شود.
- ⚠️ **تصمیم Deploy:** `SameSite=Strict` فقط وقتی Cookie ارسال می‌شود که Frontend و API روی یک «Site» باشند
  (مثلاً `app.vista.ir` و `api.vista.ir`). در توسعه (`localhost:3000` و `localhost:4000`) یک Site هستند.

## ۵. احراز دسترسی (Authorization)

- Route حساس از Middleware `requireAuth` و در موارد لازم `requireRole([...])` عبور می‌کند.
- برای Resourceهای مالکیت‌محور، Service همیشه مالکیت را بررسی می‌کند
  (`product.sellerId === user.seller.id`) — مستقل از Frontend (جلوگیری از IDOR و Mass Assignment).

## ۶. مدل پرداخت

`PaymentProvider` یک Interface انتزاعی است و در فاز فعلی `MockPaymentProvider` پیاده شده.
**قانون:** Mock فقط در `NODE_ENV !== "production"` قابل انتخاب است؛ Factory انتخاب Provider (در فاز Payment)
باید در Production با Provider واقعی یا خطای Startup پاسخ دهد. مبلغ در Interface به «تومان، عدد صحیح» است.

## ۷. Database

فایل کامل: `backend/prisma/schema.prisma`. تصمیمات کلیدی:

- **ارز:** تمام مبالغ `Int` و به **تومان** هستند. (اعشار و Float وجود ندارد.)
- **موجودی (Stock)** فقط در `ProductVariant` و فقط از طریق Backend تغییر می‌کند و `CHECK (stock >= 0)` در Database
  جلوی Overselling را می‌گیرد. هر تغییر در `InventoryMovement` (دفتر کل، فقط Append) ثبت می‌شود.
- **قیمت مؤثر Variant** = `variant.price ?? product.basePrice`. تخفیف با `product.compareAtPrice` (قیمت قبل از تخفیف) بیان می‌شود.
- **Multi-Vendor Orders:**
  ```text
  Order (پرداخت مشتری، Snapshot آدرس، مبالغ)
    └── SellerOrder (یک رکورد به‌ازای هر فروشنده، وضعیت ارسال مستقل)
          └── OrderItem (Snapshot عنوان، سایز، رنگ، SKU، قیمت واحد)
  ```
  `Order.status` = وضعیت پرداخت (PENDING/PAID/CANCELLED/REFUNDED)،
  `SellerOrder.status` = وضعیت ارسال همان فروشنده (PENDING…DELIVERED/CANCELLED).
- Variantی که در سفارش استفاده شده حذف نمی‌شود (Restrict)؛ محصول `ARCHIVED` می‌شود.
- CHECK Constraintها در `backend/prisma/checks.sql` مستند شده‌اند و در Migration به‌صورت SQL خام اعمال می‌شوند.
- Review: یک نظر به‌ازای هر (کاربر، محصول). «خرید واقعی» در Service بررسی می‌شود (وجود OrderItem پرداخت‌شده).

## ۸. Transactionهای حساس

عملیات زیر همیشه در یک `prisma.$transaction` انجام می‌شوند:
- ثبت سفارش: بررسی موجودی → کسر موجودی (Update شرطی) → ایجاد Order + SellerOrder + OrderItem → ثبت InventoryMovement → خالی‌کردن Cart
- لغو سفارش: برگشت موجودی + InventoryMovement
- کسر موجودی با Update شرطی انجام می‌شود (`WHERE stock >= quantity`) و اگر ردیفی تغییر نکرد، خطای «موجودی ناکافی» است؛
  ستون `version` برای Optimistic Locking در سناریوهای ویرایش همزمان توسط فروشنده است.

## ۹. Design System

- جهت پروژه **RTL**، فونت پیش‌فرض Vazirmatn.
- Tokenها در `frontend/tailwind.config.ts` تعریف شده‌اند و **دقیقاً** طبق پالت پرامپت مادر هستند:

| Token | HEX | نقش |
|---|---|---|
| `ivory` | `#F7F4EF` | Background اصلی |
| `ink` | `#1C1C1C` | متن و ساختار |
| `bordeaux` | `#641C2D` | Primary / Interactive |
| `champagne` | `#C9A46C` | Accent محدود (فقط تزئینی؛ برای متن `champagne-dark`) |

- Componentهای UI عمومی (`components/ui`) کاملاً مستقل از Domain هستند و از یک Barrel (`@/components/ui`) Import می‌شوند:
  Button، Input، Select، Textarea، Checkbox، Radio/RadioGroup، Card، Badge، Modal، Dropdown، Toast، Tabs، Pagination،
  Skeleton، Spinner، EmptyState، ErrorState. بدون کتابخانه UI خارجی؛ Modal بر پایه `<dialog>` بومی است.
- قوانین: فقط Logical Properties برای RTL (`ms-/me-/ps-/pe-/start-/end-`)، Border ورودی‌ها ≥ ۳:۱ کنتراست،
  Touch Target حداقل ۴۴px، هر فیلد `label` الزامی دارد.
- صفحه مرور Componentها: `/design-system` (فقط Development).

## ۱۰. Security Checklist

- [x] Helmet برای Secure Headers
- [x] CORS محدود به Origin مشخص Frontend
- [x] Body Size Limit (خطای 413 استاندارد)
- [x] Rate Limit عمومی
- [x] Rate Limit سخت‌گیرانه‌تر روی مسیرهای Auth
- [x] Validation ورودی با Zod (Middleware `validate`؛ اعمال روی هر Route در Featureها)
- [x] عدم ارسال Stack Trace/جزئیات داخلی در پاسخ خطا
- [x] .env در .gitignore + وجود .env.example
- [ ] `trust proxy` — هنگام Deploy پشت Reverse Proxy (برای Rate Limit درست)
- [ ] CSRF/SameSite — طبق تصمیم Deploy بخش ۴

## پروتکل توسعه Featureهای بعدی

هر Feature طبق بخش ۵ و ۳۱ پرامپت مادر: Analyze → Database → API Contract → Backend → Frontend →
Integration → Testing → Security Review → UI/UX Review → Final Review → Git Commit.

**وضعیت فعلی:** Phase 0 — Foundation. انجام‌شده: Monorepo، Environment Validation، Error Handling مرکزی،
Security Middleware، Shared Package (Build شده)، API Client، Design Tokens، Base UI Components، Prisma Schema، ESLint/Prettier/Vitest.
Phase 0 با Base UI Components کامل شد.
Feature «Authentication» کامل شد (Backend + Frontend، با تست). گام بعدی: Categories → Products.
