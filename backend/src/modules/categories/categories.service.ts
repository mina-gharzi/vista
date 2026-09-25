import type { CategoryDetail, CategoryNode } from "@vista/shared";
import { NotFoundError } from "../../errors/AppError";
import type { CategoriesRepository, CategoryRow } from "./categories.repository";

/** ساخت درخت از فهرست تخت با یک عبور O(n) (Map برای دسترسی سریع به هر گره با id) */
function buildTree(rows: CategoryRow[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>(
    rows.map((row) => [
      row.id,
      { id: row.id, name: row.name, slug: row.slug, imageUrl: row.imageUrl, children: [] },
    ]),
  );
  const roots: CategoryNode[] = [];

  for (const row of rows) {
    const node = nodes.get(row.id);
    if (!node) continue; // برای TypeScript؛ عملاً همیشه پیدا می‌شود چون از همین rows ساخته شد

    const parent = row.parentId ? nodes.get(row.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      // یا دسته ریشه است، یا والدش غیرفعال/حذف‌شده — در هر دو حالت به‌عنوان ریشه نمایش داده می‌شود
      roots.push(node);
    }
  }

  return roots;
}

export interface CategoriesService {
  getTree(): Promise<CategoryNode[]>;
  getBySlug(slug: string): Promise<CategoryDetail>;
}

export function createCategoriesService(repository: CategoriesRepository): CategoriesService {
  return {
    async getTree() {
      return buildTree(await repository.findAllActive());
    },

    async getBySlug(slug) {
      const category = await repository.findBySlug(slug);
      // دسته غیرفعال هم "یافت نشد" است؛ فاش نمی‌کنیم که وجود دارد ولی مخفی شده
      if (!category || !category.isActive) {
        throw new NotFoundError("دسته‌بندی یافت نشد");
      }

      const [ancestors, activeRows] = await Promise.all([
        repository.findAncestors(category.id),
        repository.findAllActive(),
      ]);

      const children = buildTree(activeRows.filter((row) => row.parentId === category.id));

      return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        imageUrl: category.imageUrl,
        breadcrumb: ancestors
          .reverse() // findAncestors از نزدیک به دور برمی‌گرداند؛ Breadcrumb از دور به نزدیک لازم دارد
          .map((row) => ({ id: row.id, name: row.name, slug: row.slug })),
        children,
      };
    },
  };
}
