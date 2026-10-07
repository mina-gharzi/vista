"use client";

import type { CreateProductInput } from "@vista/shared";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui";
import { sellerProductsApi } from "@/lib/api/sellerProducts";
import { ProductForm } from "./ProductForm";
import { useCategoryOptions } from "./useCategoryOptions";

export function SellerProductCreateView() {
  const router = useRouter();
  const { toast } = useToast();
  const { options, failed } = useCategoryOptions();

  const create = async (input: CreateProductInput) => {
    const product = await sellerProductsApi.create(input);
    toast({ title: "محصول به‌صورت پیش‌نویس ذخیره شد", variant: "success" });
    // در صفحه ویرایش می‌شود منتشرش کرد
    router.push(`/seller/products/${product.id}/edit`);
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="type-h1">افزودن محصول</h1>
      <ProductForm mode="create" categories={options} categoriesFailed={failed} onSubmit={create} />
    </div>
  );
}
