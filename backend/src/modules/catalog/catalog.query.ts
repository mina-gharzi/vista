import type { Prisma } from "@prisma/client";
import { legacyArabicVariant, searchTokens, type CatalogQuery } from "@vista/shared";

/**
 * ساخت شرط‌های Prisma به‌صورت توابع خالص (بدون دسترسی به DB) تا قابل تست مستقیم باشند.
 * هیچ مقداری از کلاینت به‌عنوان نام فیلد/عبارت مرتب‌سازی استفاده نمی‌شود؛ فقط Enumهای اعتبارسنجی‌شده.
 */

/** قاعدهٔ دید مشتری: منتشرشده + فروشندهٔ تأییدشده (تعلیق/ردشده/در انتظار هرگز دیده نمی‌شود). */
export function visibleProductWhere(sellerSlug?: string): Prisma.ProductWhereInput {
  return {
    status: "PUBLISHED",
    seller: { status: "APPROVED", ...(sellerSlug ? { storeSlug: sellerSlug } : {}) },
  };
}

/** هر کلمه باید در عنوان/توضیحات/نام دسته بیاید (AND بین کلمه‌ها، OR بین فیلدها و شکل ی/ک عربی). */
export function searchConditions(search: string | undefined): Prisma.ProductWhereInput[] {
  if (!search) return [];
  return searchTokens(search).map((token) => {
    const forms = [...new Set([token, legacyArabicVariant(token)])];
    return {
      OR: forms.flatMap((form): Prisma.ProductWhereInput[] => [
        { title: { contains: form, mode: "insensitive" } },
        { description: { contains: form, mode: "insensitive" } },
        { category: { name: { contains: form, mode: "insensitive" } } },
      ]),
    };
  });
}

/**
 * رنگ/سایز/موجودی روی «یک» تنوع فعال اعمال می‌شود: «رنگ مشکی + سایز M + موجود» یعنی همان تنوع
 * مشکی-M موجود است، نه اینکه هر شرط جدا روی تنوع‌های مختلف برقرار باشد.
 */
export function variantCondition(query: Pick<CatalogQuery, "color" | "size" | "inStock">):
  | Prisma.ProductWhereInput
  | undefined {
  if (!query.color && !query.size && !query.inStock) return undefined;
  return {
    variants: {
      some: {
        isActive: true,
        ...(query.color ? { color: { equals: query.color, mode: "insensitive" as const } } : {}),
        ...(query.size ? { size: { equals: query.size, mode: "insensitive" as const } } : {}),
        ...(query.inStock ? { stock: { gt: 0 } } : {}),
      },
    },
  };
}

export function buildCatalogWhere(
  query: Pick<
    CatalogQuery,
    "search" | "minPrice" | "maxPrice" | "seller" | "color" | "size" | "inStock" | "discounted" | "sort"
  >,
  categoryIds: string[] | undefined,
): Prisma.ProductWhereInput {
  // minPrice و maxPrice «یک» شرط روی basePrice‌اند (دو کلید جدا یکدیگر را بازنویسی می‌کردند)
  const price: Prisma.IntFilter | undefined =
    query.minPrice !== undefined || query.maxPrice !== undefined
      ? {
          ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
          ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
        }
      : undefined;
  const variant = variantCondition(query);

  return {
    ...visibleProductWhere(query.seller),
    ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
    ...(price ? { basePrice: price } : {}),
    ...(query.discounted || query.sort === "discounted" ? { compareAtPrice: { not: null } } : {}),
    AND: [...searchConditions(query.search), ...(variant ? [variant] : [])],
  };
}

/** ترتیب قطعی: کلید دوم id است تا محصولات هم‌قیمت/هم‌زمان بین صفحه‌ها جابه‌جا نشوند. */
export function buildOrderBy(sort: CatalogQuery["sort"]): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price_asc":
      return [{ basePrice: "asc" }, { id: "asc" }];
    case "price_desc":
      return [{ basePrice: "desc" }, { id: "asc" }];
    default: // newest و discounted
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}

const LETTER_SIZES = ["xxs", "xs", "s", "m", "l", "xl", "xxl", "xxxl", "free", "فری"];

/** سایزها: حروفی به ترتیب استاندارد، سپس عددی صعودی، سپس بقیه الفبایی. */
export function sortSizes(sizes: string[]): string[] {
  const rank = (size: string): [number, number, string] => {
    const lower = size.trim().toLowerCase();
    const letter = LETTER_SIZES.indexOf(lower);
    if (letter >= 0) return [0, letter, lower];
    const n = Number(lower);
    if (Number.isFinite(n)) return [1, n, lower];
    return [2, 0, lower];
  };
  return [...sizes].sort((a, b) => {
    const [ra, rb] = [rank(a), rank(b)];
    return ra[0] - rb[0] || ra[1] - rb[1] || ra[2].localeCompare(rb[2], "fa");
  });
}
