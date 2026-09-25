# routes/

فقط تعریف مسیر (HTTP Method + Path) و اتصال زنجیره Middleware → Validator → Controller.
هیچ Business Logic اینجا نوشته نشود (طبق بخش ۱۲ پرامپت مادر).
هر Module (مثلاً auth, products) فایل Router مستقل خودش را داخل `modules/<name>/` دارد
و در `app.ts` Mount می‌شود.
