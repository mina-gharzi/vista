# modules/

هر Feature یک پوشه مستقل اینجا دارد، مثلاً:

    modules/
    ├── auth/
    │   ├── auth.routes.ts
    │   ├── auth.controller.ts
    │   ├── auth.service.ts
    │   ├── auth.repository.ts
    │   └── auth.validator.ts
    ├── products/
    ├── cart/
    ├── orders/
    └── ...

این ساختار Feature-based انتخاب شده تا فایل‌های مرتبط با یک Feature کنار هم باشند و اضافه‌کردن
Feature جدید نیازی به تغییر فایل‌های پراکنده نداشته باشد (بخش‌های ۳ و ۱۳ پرامپت مادر).

Zod Schemaهایی که Frontend هم لازم دارد در `@vista/shared` تعریف می‌شوند؛ `<feature>.validator.ts`
فقط Schemaهای مخصوص Backend (مثلاً `params`/`query`) را نگه می‌دارد یا Schemaهای shared را Re-export می‌کند.
