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
Feature «Authentication» کامل شد (Backend + Frontend، با تست).
Feature «Categories» کامل شد: Prisma (imageUrl/isActive/sortOrder)، Seed دسته‌های Fashion، API عمومی
(`GET /api/categories` درخت، `GET /api/categories/:slug` جزئیات + Breadcrumb)، و در Frontend اولین
`(shop)/layout.tsx` با Header/Footer سایت اضافه شد (`SiteHeader` روی Server درخت را واکشی می‌کند؛
`CategoryNav` بدون JavaScript با `<details>/<summary>` بومی — Accessible به‌صورت پیش‌فرض).
Feature «Products — بخش فروشنده» کامل شد (بدون UI هنوز؛ فقط API):
- Prisma: مدل‌های Product/ProductVariant/ProductImage از Phase 0 بدون تغییر استفاده شدند.
- API زیر `/api/seller/products` (نیازمند requireAuth + requireRole("SELLER")):
  `POST /` (ساخت با Variant/Image تودرتو + ثبت InventoryMovement اولیه)، `GET /` (فهرست خودش، Paginated)،
  `GET /:id`، `PATCH /:id` (ویرایش فیلدهای پایه)، `PATCH /:id/status` (انتشار/آرشیو با ماتریس انتقال مجاز).
- **⚠️ وابستگی مهم:** طبق Roadmap پرامپت مادر، «Products» در Phase 1 است ولی «Seller Account» (ثبت‌نام واقعی
  فروشنده) در Phase 2 قرار دارد. چون بدون فروشنده، محصول بی‌معناست، فعلاً یک فروشنده Seed شده
  (`seller-demo@vista.test`) برای تست/توسعه استفاده می‌شود؛ Endpointهای این Feature بدون تغییر برای
  فروشنده‌های واقعی هم کار می‌کنند و بعد از Feature «Seller Account» جایگزینی لازم ندارند.
- Authorization: هر فروشنده فقط محصولات خودش را می‌بیند/می‌سازد/ویرایش می‌کند؛ محصول فروشنده دیگر ۴۰۴ می‌دهد
  (نه ۴۰۳) تا وجودش فاش نشود. انتشار بدون حداقل یک Variant مجاز نیست. ARCHIVED پایانی است (به‌خاطر Restrict
  روی OrderItem.variantId — محصول سفارش‌داده‌شده هرگز حذف نمی‌شود).
Feature «Product Catalog» کامل شد (عمومی، بدون نیاز به ورود):
- Backend: ماژول جدا `catalog` (مستقل از ماژول `products` که مخصوص فروشنده است) زیر `GET /api/products`
  (فهرست با `category`/`search`/`minPrice`/`maxPrice`/`sort`، Paginated) و `GET /api/products/:slug`
  (جزئیات — فقط محصول `PUBLISHED`، شامل تصاویر/Variantها/دسته/نام فروشگاه).
  فیلتر دسته‌بندی زیردرخت را هم شامل می‌شود (BFS از روی همه دسته‌های فعال، مثل Categories).
- Frontend: کامپوننت‌های `ProductCard`/`ProductGrid`، صفحه `/products` با فرم فیلتر GET بدون JavaScript
  (جستجو، محدوده قیمت، مرتب‌سازی) + `Pagination`، و صفحه جزئیات `/products/[slug]`.
  صفحه دسته‌بندی برگ (`/categories/[slug]` بدون زیردسته) حالا به‌جای پیام خالی، محصولات همان دسته را نشان می‌دهد.
- انتخاب تعاملی Variant و «افزودن به سبد» عمداً اینجا ساخته نشد — به Feature «Cart» موکول شد.
Feature «Cart» کامل شد (نیازمند ورود؛ بدون محدودیت نقش — هر کاربر واردشده یک سبد دارد):
- Backend: ماژول `cart` زیر `/api/cart` — `GET /` (فهرست + محاسبه لحظه‌ای قیمت/جمع کل)،
  `POST /` (افزودن Variant؛ اگر قبلاً در سبد باشد تعداد جمع می‌شود)، `PATCH /:variantId` (تغییر تعداد)،
  `DELETE /:variantId` (حذف، Idempotent). موجودی هنگام افزودن/ویرایش همیشه بررسی می‌شود (رد با ۴۰۰/۴۰۹).
  هر Item در پاسخ `isAvailable`/`availableStock` هم دارد تا اگر بعد از افزودن، فروشنده موجودی را کم کرد یا
  محصول را Archive کرد، مشتری قبل از Checkout متوجه شود (بدون تغییر خودکار تعداد).
  قیمت هرگز Snapshot نمی‌شود — هر GET با `basePrice`/`variant.price` فعلی محاسبه می‌شود؛ Snapshot واقعی
  فقط در لحظه ثبت سفارش (Feature بعدی) اتفاق می‌افتد.
- Frontend: `/cart` (صفحه‌ای Client-Only پشت `RequireAuth`، چون Access Token فقط در حافظه Client است)
  با شمارنده تعداد و حذف برای هر ردیف؛ `AddToCartForm` روی صفحه جزئیات محصول (انتخاب Variant + تعداد،
  اعلان موفق/خطا با Toast)؛ لینک «سبد خرید» در Header.
Feature «Checkout / Orders» کامل شد (به‌همراه ماژول کوچک `addresses` که Checkout به آن وابسته است):
- Backend: `addresses` (`/api/addresses` — CRUD مخصوص مالک؛ اولین آدرس همیشه پیش‌فرض)،
  `orders` با `POST /api/checkout {addressId}`، `GET /api/orders`، `GET /api/orders/:id`.
- ثبت سفارش در **یک Transaction**: بررسی آدرس → بررسی PUBLISHED بودن/موجودی «همه» آیتم‌ها (گذر اول، فقط خواندن؛
  همه مشکل‌ها یک‌جا گزارش می‌شوند) → کسر شرطی `UPDATE ... WHERE stock >= qty` (گذر دوم؛ خط دفاعی
  Race Condition) → ساخت Order + یک SellerOrder به‌ازای هر فروشنده + OrderItem با Snapshot کامل → ثبت
  InventoryMovement (ORDER_PLACED) → خالی‌کردن سبد. هر شکستی کل Transaction را Rollback می‌کند.
- ⚠️ **پرداخت:** فعلاً `MockPaymentProvider` (همیشه موفق) بلافاصله بعد از ساخت سفارش، وضعیت را PAID می‌کند.
  Shipping و Discount فعلاً صفرند. هر سه در Phase 4 (Payment/Shipping/Coupons) جایگزین می‌شوند؛ Interface
  تغییر نمی‌کند.
- Frontend: `/checkout` (انتخاب/افزودن آدرس + خلاصه + ثبت)، `/orders` (تاریخچه با Pagination)،
  `/orders/[id]` (جزئیات به‌تفکیک فروشنده با وضعیت هر SellerOrder)، لینک «سفارش‌های من» در Header.
Feature «User Profile» کامل شد — Phase 1 (MVP Core) با آن بسته می‌شود:
- Backend (داخل ماژول `auth`، چون Refresh Cookie فقط روی مسیر `/api/auth` ارسال می‌شود):
  `PATCH /api/auth/me` (ویرایش نام و موبایل؛ ایمیل/نقش قابل ویرایش نیستند)،
  `POST /api/auth/change-password` (رمز فعلی اشتباه ← 400 نه 401، چون Client روی 401 Refresh می‌زند؛
  در موفقیت همه نشست‌های قبلی باطل و برای همین دستگاه نشست تازه صادر می‌شود).
- Frontend: `/account` (حالا داخل گروه `(shop)` با Header) با Tabs: اطلاعات شخصی، مدیریت کامل آدرس‌ها
  (افزودن/ویرایش/حذف با تأیید/انتخاب پیش‌فرض)، تغییر رمز؛ لینک «سفارش‌های من».
  `AddressForm` بین Checkout و پروفایل مشترک است (حالت ویرایش با `initial`).
Feature «Wishlist» کامل شد (اولین Feature از Phase 2):
- Backend: ماژول `wishlist` زیر `/api/wishlist` — `GET /` (فهرست با `isAvailable` مثل الگوی Cart)،
  `GET /:productId` (وضعیت سریع برای یک محصول، برای دکمه قلب)، `POST /` (افزودن، Idempotent)،
  `DELETE /:productId` (حذف، Idempotent). برخلاف Cart که روی Variant است، Wishlist روی سطح Product است
  (سایز/رنگ برای «علاقه‌مندی» مهم نیست).
- Frontend: `WishlistButton` (آیکون قلب، Optimistic Update) کنار دکمه افزودن به سبد در صفحه محصول؛
  صفحه `/wishlist`؛ لینک در Header. برخلاف Cart، وضعیت Wishlist روی کارت‌های فهرست محصولات نشان داده
  نمی‌شود (فقط صفحه جزئیات و صفحه خود Wishlist) — جلوگیری از یک درخواست اضافه به‌ازای هر کارت در Catalog.
گام بعدی: Reviews، سپس Seller Account/Dashboard (جایگزینی فروشنده Demo با ثبت‌نام واقعی).
