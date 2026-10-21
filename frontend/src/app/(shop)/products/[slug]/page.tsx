import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGallery } from "@/features/catalog/ProductGallery";
import { ProductPurchasePanel } from "@/features/catalog/ProductPurchasePanel";
import { ReviewsSection } from "@/features/reviews/ReviewsSection";
import { catalogApi } from "@/lib/api/catalog";
import { ApiRequestError } from "@/lib/api/client";

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
        <ProductGallery images={product.images} title={product.title} />

        <div className="flex flex-col gap-5">
          <div>
            <p className="type-caption mb-1">
              <Link href={`/products?seller=${product.sellerStoreSlug}`} className="hover:text-bordeaux">
                {product.sellerStoreName}
              </Link>
            </p>
            <h1 className="type-h1">{product.title}</h1>
          </div>

          <ProductPurchasePanel
            productId={product.id}
            description={product.description}
            basePrice={product.basePrice}
            compareAtPrice={product.compareAtPrice}
            variants={product.variants}
          />
        </div>
      </div>

      <div className="mt-12 border-t border-border pt-10">
        <ReviewsSection productId={product.id} />
      </div>
    </main>
  );
}
