# validators/

Zod Schemaهای مخصوص Backend که نیازی به Share با Frontend ندارند، داخل پوشه همان
Module (`modules/<name>/<name>.schema.ts`). Schemaهایی که Frontend هم باید همان
Validation را انجام دهد (مثل فرم ثبت‌نام) در پکیج `@vista/shared` تعریف می‌شوند.
