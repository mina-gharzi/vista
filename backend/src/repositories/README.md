# repositories/

محل Repository هر Module، داخل پوشه همان Module (`modules/<name>/<name>.repository.ts`).
تنها لایه‌ای که مستقیم با Prisma کار می‌کند. Service هرگز مستقیماً prisma.* صدا نمی‌زند.
