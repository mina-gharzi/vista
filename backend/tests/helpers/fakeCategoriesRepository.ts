import { randomUUID } from "node:crypto";
import type {
  CategoriesRepository,
  CategoryRow,
} from "../../src/modules/categories/categories.repository";

interface StoredCategory extends CategoryRow {
  isActive: boolean;
}

/** پیاده‌سازی درون‌حافظه‌ای CategoriesRepository برای تست بدون Database واقعی. */
export class FakeCategoriesRepository implements CategoriesRepository {
  private readonly rows = new Map<string, StoredCategory>();

  seed(input: {
    name: string;
    slug: string;
    parentId?: string | null;
    isActive?: boolean;
    imageUrl?: string | null;
  }): StoredCategory {
    const row: StoredCategory = {
      id: randomUUID(),
      name: input.name,
      slug: input.slug,
      imageUrl: input.imageUrl ?? null,
      parentId: input.parentId ?? null,
      isActive: input.isActive ?? true,
    };
    this.rows.set(row.id, row);
    return row;
  }

  async findAllActive(): Promise<CategoryRow[]> {
    return [...this.rows.values()].filter((row) => row.isActive);
  }

  async findBySlug(slug: string): Promise<StoredCategory | null> {
    return [...this.rows.values()].find((row) => row.slug === slug) ?? null;
  }

  async findAncestors(categoryId: string): Promise<CategoryRow[]> {
    const chain: CategoryRow[] = [];
    let parentId = this.rows.get(categoryId)?.parentId ?? null;
    while (parentId) {
      const parent = this.rows.get(parentId);
      if (!parent) break;
      chain.push(parent);
      parentId = parent.parentId;
    }
    return chain;
  }
}
