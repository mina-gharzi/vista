import type {
  CreateProductInput,
  PaginatedResponse,
  ProductStatus,
  SellerProduct,
  SellerProductsQuery,
  UpdateProductInput,
} from "@vista/shared";
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../errors/AppError";
import { slugify, withUniqueSuffix } from "../../utils/slug";
import { toSellerProduct } from "./products.mapper";
import { SLUG_TAKEN_MESSAGE, type ProductsRepository } from "./products.repository";

const MAX_SLUG_ATTEMPTS = 5;

/** فقط این انتقال‌های وضعیت مجازند. ARCHIVED پایانی است (بخش ۷ ARCHITECTURE.md). */
const ALLOWED_TRANSITIONS: Record<ProductStatus, ProductStatus[]> = {
  DRAFT: ["PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["DRAFT", "ARCHIVED"],
  ARCHIVED: [],
};

async function requireApprovedSeller(
  repository: ProductsRepository,
  userId: string,
): Promise<string> {
  const seller = await repository.findSellerByUserId(userId);
  if (!seller) {
    throw new AuthorizationError("برای مدیریت محصول ابتدا باید حساب فروشندگی ایجاد کنید");
  }
  if (seller.status === "SUSPENDED") {
    throw new AuthorizationError("حساب فروشندگی شما مسدود شده است");
  }
  // هر وضعیتی جز APPROVED (PENDING یا REJECTED) اجازه مدیریت محصول ندارد؛
  // بررسی «نه APPROVED» امن‌تر از فهرست وضعیت‌های ممنوع است (وضعیت جدید به‌طور پیش‌فرض بسته می‌ماند)
  if (seller.status !== "APPROVED") {
    throw new AuthorizationError("حساب فروشندگی شما هنوز تأیید نشده است");
  }
  return seller.id;
}

async function requireOwnedProduct(
  repository: ProductsRepository,
  sellerId: string,
  productId: string,
) {
  const product = await repository.findOwnedById(sellerId, productId);
  // برای فروشنده دیگر همیشه 404 (نه 403) تا وجود محصول فاش نشود — جلوگیری از IDOR
  if (!product) {
    throw new NotFoundError("محصول یافت نشد");
  }
  return product;
}

async function generateUniqueSlug(repository: ProductsRepository, title: string): Promise<string> {
  const base = slugify(title);
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
    const candidate = withUniqueSuffix(base);
    if (!(await repository.slugExists(candidate))) return candidate;
  }
  throw new ConflictError("ساخت شناسه یکتا برای محصول ممکن نشد؛ دوباره تلاش کنید");
}

const slugTaken = () => new ConflictError(SLUG_TAKEN_MESSAGE, { slug: [SLUG_TAKEN_MESSAGE] });

/** حداقل شرایط انتشار؛ قانون سمت سرور (مخفی‌کردن دکمه در UI کافی نیست) */
function publishBlockers(
  product: { title: string; description: string; basePrice: number; variants: unknown[] },
  categoryActive: boolean,
): string[] {
  const blockers: string[] = [];
  if (product.title.trim().length < 3) blockers.push("عنوان محصول معتبر نیست");
  if (product.description.trim().length < 10) blockers.push("توضیحات محصول کافی نیست");
  if (!(product.basePrice > 0)) blockers.push("قیمت محصول معتبر نیست");
  if (!categoryActive) blockers.push("دسته‌بندی محصول معتبر یا فعال نیست");
  if (product.variants.length === 0) blockers.push("حداقل یک تنوع (سایز/رنگ) لازم است");
  return blockers;
}

export interface ProductsService {
  /** گارد پیش از اعتبارسنجی Body: فقط فروشنده APPROVED (برای غیرمجاز، حتی پیام خطای فیلدها فاش نمی‌شود) */
  assertCanManage(userId: string): Promise<void>;
  archive(userId: string, productId: string): Promise<SellerProduct>;
  createProduct(userId: string, input: CreateProductInput): Promise<SellerProduct>;
  updateProduct(
    userId: string,
    productId: string,
    input: UpdateProductInput,
  ): Promise<SellerProduct>;
  changeStatus(userId: string, productId: string, status: ProductStatus): Promise<SellerProduct>;
  getMine(userId: string, productId: string): Promise<SellerProduct>;
  listMine(userId: string, query: SellerProductsQuery): Promise<PaginatedResponse<SellerProduct>>;
}

export function createProductsService(repository: ProductsRepository): ProductsService {
  return {
    async assertCanManage(userId) {
      await requireApprovedSeller(repository, userId);
    },

    async createProduct(userId, input) {
      const sellerId = await requireApprovedSeller(repository, userId);

      if (!(await repository.categoryIsActive(input.categoryId))) {
        throw new ValidationError("دسته‌بندی نامعتبر است", {
          categoryId: ["دسته‌بندی یافت نشد یا غیرفعال است"],
        });
      }

      let slug: string;
      if (input.slug) {
        if (await repository.slugExists(input.slug)) throw slugTaken();
        slug = input.slug;
      } else {
        slug = await generateUniqueSlug(repository, input.title);
      }

      const product = await repository.createWithVariants(
        {
          sellerId,
          categoryId: input.categoryId,
          title: input.title,
          slug,
          description: input.description,
          basePrice: input.basePrice,
          compareAtPrice: input.compareAtPrice,
          variants: input.variants,
          images: input.images,
        },
        userId,
      );

      return toSellerProduct(product);
    },

    async updateProduct(userId, productId, input) {
      const sellerId = await requireApprovedSeller(repository, userId);
      const current = await requireOwnedProduct(repository, sellerId, productId);

      if (current.status === "ARCHIVED") {
        throw new ConflictError("محصول آرشیوشده قابل ویرایش نیست");
      }

      if (input.categoryId && !(await repository.categoryIsActive(input.categoryId))) {
        throw new ValidationError("دسته‌بندی نامعتبر است", {
          categoryId: ["دسته‌بندی یافت نشد یا غیرفعال است"],
        });
      }

      // مقایسه با مقدار نهایی (فیلد ویرایش‌نشده هم لحاظ می‌شود) تا basePrice تنها را ناسازگار نکنیم
      const nextBasePrice = input.basePrice ?? current.basePrice;
      const nextCompareAtPrice =
        input.compareAtPrice === undefined ? current.compareAtPrice : input.compareAtPrice;
      if (nextCompareAtPrice !== null && nextCompareAtPrice <= nextBasePrice) {
        throw new ValidationError("قیمت نامعتبر است", {
          compareAtPrice: ["قیمت قبل از تخفیف باید بیشتر از قیمت فعلی باشد"],
        });
      }

      if (input.slug !== undefined && input.slug !== current.slug) {
        // تغییر شناسه محصول منتشرشده لینک‌های موجود را می‌شکند
        if (current.status === "PUBLISHED") {
          throw new ConflictError("شناسه محصول منتشرشده قابل تغییر نیست؛ ابتدا انتشار را لغو کنید", {
            slug: ["شناسه محصول منتشرشده قابل تغییر نیست"],
          });
        }
        if (await repository.slugExists(input.slug)) throw slugTaken();
      }

      const updated = await repository.updateFields(productId, input);
      return toSellerProduct(updated);
    },

    async changeStatus(userId, productId, status) {
      const sellerId = await requireApprovedSeller(repository, userId);
      const current = await requireOwnedProduct(repository, sellerId, productId);

      if (current.status === status) {
        return toSellerProduct(current); // بدون تغییر — Idempotent
      }

      if (!ALLOWED_TRANSITIONS[current.status].includes(status)) {
        throw new ConflictError(`تغییر وضعیت از ${current.status} به ${status} مجاز نیست`);
      }

      if (status === "PUBLISHED") {
        const blockers = publishBlockers(current, await repository.categoryIsActive(current.categoryId));
        if (blockers.length > 0) {
          throw new ConflictError("محصول هنوز آماده انتشار نیست", { status: blockers });
        }
      }

      const updated = await repository.updateStatus(productId, status);
      return toSellerProduct(updated);
    },

    async archive(userId, productId) {
      return this.changeStatus(userId, productId, "ARCHIVED");
    },

    async getMine(userId, productId) {
      const sellerId = await requireApprovedSeller(repository, userId);
      const product = await requireOwnedProduct(repository, sellerId, productId);
      return toSellerProduct(product);
    },

    async listMine(userId, query) {
      const sellerId = await requireApprovedSeller(repository, userId);
      const { items, total } = await repository.findManyForSeller(sellerId, query);
      return {
        data: items.map(toSellerProduct),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
      };
    },
  };
}
