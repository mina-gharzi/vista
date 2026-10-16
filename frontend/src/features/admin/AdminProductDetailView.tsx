"use client";

import {
  adminProductStatusSchema,
  PRODUCT_STATUS_LABEL,
  type AdminProductDetail,
  type ProductAdminTarget,
} from "@vista/shared";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, buttonClasses, Card } from "@/components/ui";
import { adminApi } from "@/lib/api/admin";
import { formatDateTime, formatNumber, formatPrice } from "@/lib/utils/format";
import { Field, QueryBoundary } from "./AdminParts";
import { productStatusBadge } from "./adminLabels";
import { ReasonDialog } from "./ReasonDialog";
import { useAdminQuery } from "./useAdminQuery";

const PRODUCT_ACTION: Record<ProductAdminTarget, { label: string; confirm: string }> = {
  DRAFT: {
    label: "لغو انتشار",
    confirm: "محصول از فروشگاه پنهان و به پیش‌نویس برمی‌گردد (موجودی و سفارش‌ها دست‌نخورده می‌مانند). فروشنده می‌تواند دوباره منتشر کند.",
  },
  ARCHIVED: {
    label: "بایگانی (رد دائمی)",
    confirm: "محصول بایگانی می‌شود و این تغییر برگشت‌پذیر نیست؛ موجودی و سفارش‌های قبلی حفظ می‌شود.",
  },
};

function Body({ product, onAction }: { product: AdminProductDetail; onAction: (t: ProductAdminTarget) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="type-h1">{product.title}</h1>
          <Badge variant={productStatusBadge[product.status]}>{PRODUCT_STATUS_LABEL[product.status]}</Badge>
          {product.sellerBlocked && <Badge variant="danger">فروشندهٔ غیرفعال</Badge>}
        </div>
        <Link href="/admin/products" className={buttonClasses({ variant: "ghost", size: "sm" })}>
          بازگشت به محصولات
        </Link>
      </header>

      {product.allowedTransitions.length > 0 ? (
        <Card as="section" aria-label="اقدام‌های مدیریتی" className="flex flex-wrap items-center gap-3">
          {product.allowedTransitions.map((t) => (
            <Button key={t} variant="secondary" onClick={() => onAction(t)}>
              {PRODUCT_ACTION[t].label}
            </Button>
          ))}
        </Card>
      ) : (
        <p className="text-sm text-ink-muted">این محصول بایگانی‌شده است و اقدام دیگری ممکن نیست.</p>
      )}

      <Card as="section" aria-labelledby="product-info" className="flex flex-col gap-4">
        <h2 id="product-info" className="type-h3">
          اطلاعات محصول
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="فروشنده" value={<Link href={`/admin/sellers/${product.sellerId}`} className="text-bordeaux hover:underline">{product.sellerName}</Link>} />
          <Field label="دسته‌بندی" value={product.categoryName} />
          <Field label="قیمت پایه" value={formatPrice(product.basePrice)} />
          <Field label="موجودی کل" value={formatNumber(product.totalStock)} />
          <Field label="تاریخ ایجاد" value={formatDateTime(product.createdAt)} />
          <Field label="توضیحات" value={product.description} />
        </dl>
        {product.images.length > 0 && (
          <ul aria-label="تصاویر محصول" className="flex flex-wrap gap-2">
            {product.images.map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <li key={i}><img src={img.url} alt={img.altText ?? product.title} className="h-24 w-24 rounded object-cover" /></li>
            ))}
          </ul>
        )}
      </Card>

      <Card as="section" aria-labelledby="product-variants" className="flex flex-col gap-3">
        <h2 id="product-variants" className="type-h3">
          تنوع‌ها و موجودی
        </h2>
        <ul className="flex flex-col gap-2">
          {product.variants.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                {v.size} / {v.color} · <span dir="ltr">{v.sku}</span>
              </span>
              <span className="tabular-nums">
                {formatPrice(v.price ?? product.basePrice)} · موجودی {formatNumber(v.stock)}
                {!v.isActive && " · غیرفعال"}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card as="section" aria-labelledby="product-history" className="flex flex-col gap-3">
        <h2 id="product-history" className="type-h3">
          سابقهٔ ممیزی
        </h2>
        {product.history.length === 0 ? (
          <p className="text-sm text-ink-muted">تغییری ثبت نشده است.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {product.history.map((h) => (
              <li key={h.id} className="text-sm">
                {PRODUCT_STATUS_LABEL[h.fromStatus as keyof typeof PRODUCT_STATUS_LABEL] ?? h.fromStatus} ←{" "}
                {PRODUCT_STATUS_LABEL[h.toStatus as keyof typeof PRODUCT_STATUS_LABEL] ?? h.toStatus}
                <span className="text-ink-muted">
                  {" "}
                  · {h.adminName} · {formatDateTime(h.createdAt)}
                </span>
                {h.reason && <p className="text-ink-muted">دلیل: {h.reason}</p>}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

export function AdminProductDetailView({ productId }: { productId: string }) {
  const { state, reload, setData } = useAdminQuery(() => adminApi.product(productId), productId);
  const [target, setTarget] = useState<ProductAdminTarget | null>(null);

  return (
    <QueryBoundary state={state} reload={reload} label="جزئیات محصول" notFoundTitle="محصول یافت نشد">
      {(product) => (
        <>
          <Body product={product} onAction={setTarget} />
          {target && (
            <ReasonDialog
              title={PRODUCT_ACTION[target].label}
              description={`${product.title} — ${PRODUCT_ACTION[target].confirm}`}
              confirmLabel="تأیید و ثبت"
              danger={target === "ARCHIVED"}
              reasonRequired
              validate={(reason) => {
                const parsed = adminProductStatusSchema.safeParse({ status: target, reason });
                return parsed.success
                  ? { ok: true }
                  : { ok: false, error: parsed.error.issues[0]?.message ?? "دلیل معتبر نیست" };
              }}
              successMessage="وضعیت محصول به‌روز شد"
              onSubmit={async (reason) => {
                setData(await adminApi.changeProductStatus(product.id, { status: target, reason }));
              }}
              onClose={() => setTarget(null)}
              onStale={reload}
            />
          )}
        </>
      )}
    </QueryBoundary>
  );
}
