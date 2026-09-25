import type { CategoryDetail, CategoryNode } from "@vista/shared";
import { apiRequest } from "./client";

/** بدون auth: عمومی هستند و هر بازدیدکننده‌ای (حتی مهمان) باید ببیندشان. */
export const categoriesApi = {
  getTree: () => apiRequest<CategoryNode[]>("/categories"),
  getBySlug: (slug: string) =>
    apiRequest<CategoryDetail>(`/categories/${encodeURIComponent(slug)}`),
};
