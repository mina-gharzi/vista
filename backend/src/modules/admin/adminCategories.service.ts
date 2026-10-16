import type {
  AdminCategoriesQuery,
  AdminCategory,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@vista/shared";
import { ConflictError, NotFoundError, ValidationError } from "../../errors/AppError";
import {
  CategoryInUseError,
  DuplicateCategorySlugError,
  type AdminCategoriesRepository,
  type AdminCategoriesTx,
  type AdminCategoryRow,
  type CategoryRecord,
  type CategoryWriteData,
} from "./adminCategories.repository";

export interface AdminCategoriesService {
  list(query: AdminCategoriesQuery): Promise<AdminCategory[]>;
  create(adminId: string, input: CreateCategoryInput): Promise<AdminCategory>;
  update(adminId: string, id: string, input: UpdateCategoryInput): Promise<AdminCategory>;
  remove(adminId: string, id: string): Promise<void>;
}

type JsonPrimitive = string | number | boolean | null;

const SLUG_TAKEN = "این شناسه (slug) قبلاً استفاده شده است";
const slugConflict = () => new ConflictError(SLUG_TAKEN, { slug: [SLUG_TAKEN] });

function toApi(row: AdminCategoryRow): AdminCategory {
  return { ...row };
}

async function requireParent(tx: AdminCategoriesTx, parentId: string): Promise<CategoryRecord> {
  const parent = await tx.findById(parentId);
  if (!parent) {
    throw new ValidationError("دستهٔ والد یافت نشد", { parentId: ["دستهٔ والد یافت نشد"] });
  }
  return parent;
}

async function requireRow(tx: AdminCategoriesTx, id: string): Promise<AdminCategoryRow> {
  const row = await tx.findWithCounts(id);
  if (!row) throw new NotFoundError("دسته‌بندی یافت نشد");
  return row;
}

/**
 * قوانین (Server-side):
 *  - slug یکتا (بررسی اولیه + Unique دیتابیس).
 *  - والد باید وجود داشته باشد؛ خودِ دسته یا هر «نسل زیرین» آن نمی‌تواند والدش شود (جلوگیری از حلقه،
 *    داخل Transaction با قفل درخت تا دو جابه‌جایی همزمان حلقه نسازند).
 *  - غیرفعال‌سازی: ممنوع وقتی محصول «منتشرشده» یا زیردستهٔ «فعال» دارد (۴۰۹ با توضیح).
 *  - حذف: فقط وقتی هیچ محصول (با هر وضعیت) و هیچ زیردسته‌ای ندارد؛ محصولات با سفارش‌های قبلی هرگز بی‌دسته نمی‌شوند.
 *  - هر نوشتن + ممیزی در یک Transaction است.
 */
export function createAdminCategoriesService(repository: AdminCategoriesRepository): AdminCategoriesService {
  const mapDuplicate = (error: unknown): never => {
    if (error instanceof DuplicateCategorySlugError) throw slugConflict();
    throw error;
  };

  return {
    async list({ q, sort }) {
      let rows = await repository.listAll();
      if (q) {
        const needle = q.toLowerCase();
        rows = rows.filter(
          (row) => row.name.toLowerCase().includes(needle) || row.slug.toLowerCase().includes(needle),
        );
      }
      if (sort === "name") rows = [...rows].sort((a, b) => a.name.localeCompare(b.name, "fa"));
      else if (sort === "products") rows = [...rows].sort((a, b) => b.productCount - a.productCount);
      // sort=order: ترتیب پیش‌فرض Repository (sortOrder، سپس نام)
      return rows.map(toApi);
    },

    async create(adminId, input) {
      try {
        return await repository.transaction(async (tx) => {
          await tx.lockTree();
          if (await tx.slugTaken(input.slug)) throw slugConflict();
          if (input.parentId) await requireParent(tx, input.parentId);

          const data: CategoryWriteData = {
            name: input.name,
            slug: input.slug,
            imageUrl: input.imageUrl ?? null,
            isActive: input.isActive ?? true,
            sortOrder: input.sortOrder ?? 0,
            parentId: input.parentId ?? null,
          };
          const created = await tx.create(data);
          await tx.audit({
            adminId,
            action: "CATEGORY_CREATED",
            targetType: "CATEGORY",
            targetId: created.id,
            details: { name: created.name, slug: created.slug },
          });
          return toApi(await requireRow(tx, created.id));
        });
      } catch (error) {
        return mapDuplicate(error);
      }
    },

    async update(adminId, id, input) {
      try {
        return await repository.transaction(async (tx) => {
          await tx.lockTree();
          const current = await tx.findById(id);
          if (!current) throw new NotFoundError("دسته‌بندی یافت نشد");

          const patch: Partial<CategoryWriteData> = {};
          if (input.name !== undefined) patch.name = input.name;
          if (input.imageUrl !== undefined) patch.imageUrl = input.imageUrl;
          if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;

          if (input.slug !== undefined && input.slug !== current.slug) {
            if (await tx.slugTaken(input.slug, id)) throw slugConflict();
            patch.slug = input.slug;
          }

          if (input.parentId !== undefined && input.parentId !== current.parentId) {
            if (input.parentId !== null) {
              if (input.parentId === id) {
                throw new ValidationError("یک دسته نمی‌تواند والد خودش باشد", {
                  parentId: ["یک دسته نمی‌تواند والد خودش باشد"],
                });
              }
              await requireParent(tx, input.parentId);
              // اگر «id» در زنجیرهٔ والدهای والد جدید باشد، جابه‌جایی حلقه می‌سازد
              if ((await tx.ancestorIds(input.parentId)).includes(id)) {
                throw new ValidationError("این جابه‌جایی حلقه در سلسله‌مراتب دسته‌ها می‌سازد", {
                  parentId: ["این جابه‌جایی حلقه در سلسله‌مراتب دسته‌ها می‌سازد"],
                });
              }
            }
            patch.parentId = input.parentId;
          }

          if (input.isActive !== undefined && input.isActive !== current.isActive) {
            if (input.isActive === false) {
              const counts = await tx.counts(id);
              if (counts.publishedProducts > 0) {
                throw new ConflictError(
                  `این دسته ${counts.publishedProducts} محصول منتشرشده دارد و غیرفعال‌کردن آن مجاز نیست. ابتدا محصولات را جابه‌جا یا بایگانی کنید.`,
                );
              }
              if (counts.activeChildren > 0) {
                throw new ConflictError(
                  `این دسته ${counts.activeChildren} زیردستهٔ فعال دارد. ابتدا زیردسته‌ها را غیرفعال یا جابه‌جا کنید.`,
                );
              }
            }
            patch.isActive = input.isActive;
          }

          const changes: Record<string, { from: JsonPrimitive; to: JsonPrimitive }> = {};
          for (const [key, value] of Object.entries(patch)) {
            changes[key] = { from: current[key as keyof CategoryRecord], to: value };
          }
          if (Object.keys(changes).length > 0) {
            await tx.update(id, patch);
            await tx.audit({
              adminId,
              action: "CATEGORY_UPDATED",
              targetType: "CATEGORY",
              targetId: id,
              details: { changes },
            });
          }
          return toApi(await requireRow(tx, id));
        });
      } catch (error) {
        return mapDuplicate(error);
      }
    },

    async remove(adminId, id) {
      try {
        await repository.transaction(async (tx) => {
          await tx.lockTree();
          const current = await tx.findById(id);
          if (!current) throw new NotFoundError("دسته‌بندی یافت نشد");
          const counts = await tx.counts(id);
          if (counts.products > 0) {
            throw new ConflictError(
              `این دسته ${counts.products} محصول دارد و حذف نمی‌شود. به‌جای حذف می‌توانید آن را غیرفعال کنید.`,
            );
          }
          if (counts.children > 0) {
            throw new ConflictError(`این دسته ${counts.children} زیردسته دارد. ابتدا آن‌ها را جابه‌جا یا حذف کنید.`);
          }
          await tx.remove(id);
          await tx.audit({
            adminId,
            action: "CATEGORY_DELETED",
            targetType: "CATEGORY",
            targetId: id,
            details: { name: current.name, slug: current.slug },
          });
        });
      } catch (error) {
        if (error instanceof CategoryInUseError) {
          throw new ConflictError("دسته هم‌زمان استفاده شد و حذف نشد. دوباره تلاش کنید.");
        }
        throw error;
      }
    },
  };
}
