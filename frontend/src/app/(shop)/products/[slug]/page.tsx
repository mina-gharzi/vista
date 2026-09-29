import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import { AddToCartForm } from "@/features/cart/components/AddToCartForm";
import { WishlistButton } from "@/features/wishlist/WishlistButton";
import { catalogApi } from "@/lib/api/catalog";
import { ApiRequestError } from "@/lib/api/client";
import { formatPrice } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

interface ProductDetailPageProps {
  params: { slug: string };
}

async function loadProduct(slug: string) {
  try {
    return await catalogApi.getBySlug(slug);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const product = await loadProduct(params.slug);
  return { title: product?.title ?? "محصول" };
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const product = await loadProduct(params.slug);
  if (!product) notFound();

  const hasDiscount = product.compareAtPrice !== null && product.compareAtPrice > product.basePrice;
  const availableSizes = [...new Set(product.variants.map((v) => v.size))];
  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <nav
        aria-label="مسیر دسته‌بندی"
        className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-ink-muted"
      >
        <Link href="/categories" className="hover:text-bordeaux">
          دسته‌بندی‌ها
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={`/categories/${product.category.slug}`} className="hover:text-bordeaux">
          {product.category.name}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="text-ink">
          {product.title}
        </span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="aspect-square overflow-hidden rounded-lg bg-ivory-soft">
            {product.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element -- تصاویر از دامنه‌های متنوع فروشندگان می‌آیند
              <img
                src={product.images[0].url}
                alt={product.images[0].altText ?? product.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-ink-faint">
                بدون تصویر
              </div>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {product.images.slice(1).map((image, index) => (
                <div
                  key={image.url}
                  className="aspect-square overflow-hidden rounded bg-ivory-soft"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- تصاویر از دامنه‌های متنوع فروشندگان می‌آیند */}
                  <img
                    src={image.url}
                    alt={image.altText ?? `${product.title} ${index + 2}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <p className="type-caption mb-1">{product.sellerStoreName}</p>
            <h1 className="type-h1">{product.title}</h1>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="type-price text-2xl">{formatPrice(product.basePrice)}</span>
            {hasDiscount && (
              <>
                <span className="text-ink-faint line-through">
                  {formatPrice(product.compareAtPrice as number)}
                </span>
                <Badge variant="premium">
                  ٪{Math.round((1 - product.basePrice / (product.compareAtPrice as number)) * 100)}{" "}
                  تخفیف
                </Badge>
              </>
            )}
          </div>

          <p className="whitespace-pre-line text-ink-muted">{product.description}</p>

          <Card padding="md" className="flex flex-col gap-3">
            <h2 className="type-label">تنوع موجود</h2>
            {totalStock === 0 ? (
              <Badge variant="danger">ناموجود</Badge>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {availableSizes.map((size) => (
                    <span
                      key={size}
                      className="rounded border border-border px-3 py-1 text-sm text-ink"
                    >
                      {size}
                    </span>
                  ))}
                </div>
                <ul className="flex flex-col gap-1 text-sm text-ink-muted">
                  {product.variants.map((variant) => (
                    <li key={variant.id} className="flex items-center justify-between">
                      <span>
                        {variant.size} / {variant.color}
                      </span>
                      <span className={variant.stock === 0 ? "text-danger" : ""}>
                        {variant.stock === 0 ? "ناموجود" : `${variant.stock} عدد موجود`}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <div className="flex items-start gap-3">
            <div className="flex-1">
              <AddToCartForm variants={product.variants} />
            </div>
            <WishlistButton productId={product.id} />
          </div>
        </div>
      </div>
    </main>
  );
}
