"use client";

import type { CategoryNode } from "@vista/shared";
import { useEffect, useState } from "react";
import { categoriesApi } from "@/lib/api/categories";

export interface CategoryOption {
  id: string;
  /** مسیر کامل: «زنانه › مانتو» */
  label: string;
}

export function flattenCategories(nodes: CategoryNode[], trail: string[] = []): CategoryOption[] {
  return nodes.flatMap((node) => {
    const path = [...trail, node.name];
    return [{ id: node.id, label: path.join(" › ") }, ...flattenCategories(node.children, path)];
  });
}

/** درخت عمومی دسته‌بندی‌ها، یک‌بار و تخت‌شده؛ هم برای Select فرم و هم برای نمایش نام دسته در فهرست. */
export function useCategoryOptions() {
  const [options, setOptions] = useState<CategoryOption[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    categoriesApi
      .getTree()
      .then((tree) => {
        if (!cancelled) setOptions(flattenCategories(tree));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { options, failed };
}
