"use client";

import type { SellerProduct, UpdateProductInput } from "@vista/shared";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, buttonClasses, Card, EmptyState, ErrorState, Skeleton, useToast } from "@/components/ui";
import { ApiRequestError } from "@/lib/api/client";
import { sellerProductsApi } from "@/lib/api/sellerProducts";
import { PRODUCT_STATUS_LABEL, PRODUCT_STATUS_VARIANT } from "./productStatus";
import { ProductForm } from "./ProductForm";
import { ProductStatusActions } from "./ProductStatusActions";
import { VariantBuilder } from "@/features/sellerVariants/VariantBuilder";
import { useCategoryOptions } from "./useCategoryOptions";

type State =
  | { status: "loading" }
  | { status: "ready"; product: SellerProduct }
  | { status: "notFound" }
  | { status: "forbidden"; message: string }
  | { status: "error" };

export function SellerProductEditView({ productId }: { productId: string }) {
  const { toast } = useToast();
  const { options, failed } = useCategoryOptions();
  const [state, setState] = useState<State>({ status: "loading" });
  // با هر ذخیره موفق فرم دوباره ساخته می‌شود تا مقادیر نرمال‌شده سرور (مثل slug) نمایش داده شود
  const [formKey, setFormKey] = useState(0);

  const load = useCallback(() => {
    setState({ status: "loading" });
    sellerProductsApi
      .get(productId)
      .then((product) => setState({ status: "ready", product }))
      .catch((error: unknown) => {
        if (error instanceof ApiRequestError && error.status === 404) setState({ status: "notFound" });
        else if (error instanceof ApiRequestError && error.status === 403)
          setState({ status: "forbidden", message: error.message });
        else setState({ status: "error" });
      });
  }, [productId]);

  useEffect(load, [load]);

  if (state.status === "loading") {
    return (
      <div aria-busy="true" aria-label="در حال بارگذاری محصول" className="flex flex-col gap-4">
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (state.status === "notFound") {
    return (
      <EmptyState
        title="محصول یافت نشد"
        description="این محصول وجود ندارد یا متعلق به فروشگاه شما نیست."
        action={
          <Link href="/seller/products" className={buttonClasses({ variant: "primary" })}>
            بازگشت به محصولات
          </Link>
        }
      />
    );
  }
  if (state.status === "forbidden") {
    return <EmptyState title="دسترسی ندارید" description={state.message} />;
  }
  if (state.status === "error") {
    return <ErrorState description="دریافت محصول انجام نشد." onRetry={load} />;
  }

  const { product } = state;
  const editable = product.status !== "ARCHIVED";

  const save = async (input: UpdateProductInput) => {
    const updated = await sellerProductsApi.update(product.id, input);
    toast({ title: "تغییرات ذخیره شد", variant: "success" });
    setState({ status: "ready", product: updated });
    setFormKey((k) => k + 1);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="type-h1">ویرایش محصول</h1>
          <Badge variant={PRODUCT_STATUS_VARIANT[product.status]}>{PRODUCT_STATUS_LABEL[product.status]}</Badge>
        </div>
        <Link href="/seller/products" className={buttonClasses({ variant: "ghost" })}>
          بازگشت به فهرست
        </Link>
      </header>

      <Card as="section" aria-label="وضعیت انتشار" className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-ink-muted">وضعیت انتشار:</span>
        <ProductStatusActions
          product={product}
          size="md"
          onChanged={(updated) => {
            setState({ status: "ready", product: updated });
            setFormKey((k) => k + 1);
          }}
        />
        {!editable && <span className="text-sm text-ink-muted">محصول آرشیو شده و قابل ویرایش نیست.</span>}
      </Card>

      {editable && (
        <ProductForm
          key={formKey}
          mode="edit"
          product={product}
          categories={options}
          categoriesFailed={failed}
          onSubmit={save}
        />
      )}

      <VariantBuilder product={product} />
    </div>
  );
}
