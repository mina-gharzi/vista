import type {
  CatalogFilterOptions,
  CatalogFilterOptionsQuery,
  CatalogQuery,
  PaginatedResponse,
  ProductCardSummary,
  PublicProductDetail,
} from "@vista/shared";
import { NotFoundError } from "../../errors/AppError";
import type { CatalogRepository } from "./catalog.repository";
import { toProductCard, toProductDetail } from "./catalog.mapper";
import { sortSizes } from "./catalog.query";

export interface CatalogService {
  list(query: CatalogQuery): Promise<PaginatedResponse<ProductCardSummary>>;
  getBySlug(slug: string): Promise<PublicProductDetail>;
  filterOptions(query: CatalogFilterOptionsQuery): Promise<CatalogFilterOptions>;
}

export function createCatalogService(repository: CatalogRepository): CatalogService {
  return {
    async list(query) {
      let categoryIds: string[] | undefined;

      if (query.category) {
        const resolved = await repository.resolveCategorySubtreeIds(query.category);
        // دسته ناموجود/غیرفعال یعنی فهرست خالی، نه خطا — این یک فیلتر است نه واکشی یک منبع مشخص
        if (resolved === null) {
          return {
            data: [],
            pagination: { page: query.page, limit: query.limit, total: 0, totalPages: 1 },
          };
        }
        categoryIds = resolved;
      }

      const { items, total } = await repository.findMany(query, categoryIds);

      return {
        data: items.map(toProductCard),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
      };
    },

    async filterOptions(query) {
      let categoryIds: string[] | undefined;
      if (query.category) {
        const resolved = await repository.resolveCategorySubtreeIds(query.category);
        if (resolved === null) return { colors: [], sizes: [], priceRange: null };
        categoryIds = resolved;
      }
      const options = await repository.filterOptions({ search: query.search }, categoryIds);
      return { ...options, sizes: sortSizes(options.sizes) };
    },

    async getBySlug(slug) {
      const product = await repository.findPublishedBySlug(slug);
      if (!product) {
        throw new NotFoundError("محصول یافت نشد");
      }
      return toProductDetail(product);
    },
  };
}
