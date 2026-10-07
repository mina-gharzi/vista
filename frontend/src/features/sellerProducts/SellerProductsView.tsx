"use client";

import type { ProductStatus, SellerProduct } from "@vista/shared";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  buttonClasses,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Select,
  Skeleton,
} from "@/components/ui";
import { formatDate, formatPrice } from "@/lib/utils/format";
import { actionsFor, PRODUCT_STATUS_LABEL, PRODUCT_STATUS_VARIANT } from "./productStatus";
import { ProductStatusActions } from "./ProductStatusActions";
import { useCategoryOptions } from "./useCategoryOptions";
import { useSellerProducts, type ProductFilters } from "./useSellerProducts";

const ROW_GRID = "md:grid md:grid-cols-[4fr_2fr_2fr_1.5fr_2fr_3fr] md:items-center md:gap-4";

function ProductRow({
  product,
  categoryName,
  onChanged,
}: {
  product: SellerProduct;
  categoryName: string;
  onChanged: () => void;
}) {
  const actions = actionsFor(product.status);
  const cover = product.images[0];
  return (
    <li>
      <Card as="article" padding="sm" className={`flex flex-col gap-3 ${ROW_GRID}`}>
        <div className="flex items-center gap-3">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover.url} alt={cover.altText ?? product.title} className="h-14 w-14 shrink-0 rounded object-cover" />
          ) : (
            <div aria-hidden="true" className="h-14 w-14 shrink-0 rounded bg-ivory" />
          )}
          <h3 className="font-medium">{product.title}</h3>
        </div>
        <p className="text-sm text-ink-muted">
          <span className="md:sr-only">دسته‌بندی: </span>
          {categoryName}
        </p>
        <p className="text-sm tabular-nums">
          <span className="md:sr-only">قیمت: </span>
          {formatPrice(product.basePrice)}
        </p>
        <div>
          <Badge variant={PRODUCT_STATUS_VARIANT[product.status]}>
            {PRODUCT_STATUS_LABEL[product.status]}
          </Badge>
        </div>
        <p className="text-sm text-ink-muted">
          <span className="md:sr-only">تاریخ ایجاد: </span>
          {formatDate(product.createdAt)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {actions.edit && (
            <Link
              href={`/seller/products/${product.id}/edit`}
              aria-label={`ویرایش ${product.title}`}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              ویرایش
            </Link>
          )}
          <ProductStatusActions product={product} onChanged={onChanged} />
        </div>
      </Card>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div aria-busy="true" aria-label="در حال بارگذاری محصولات" className="flex flex-col gap-3">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}

export function SellerProductsView() {
  const [filters, setFilters] = useState<ProductFilters>({ page: 1, status: "", q: "" });
  const [search, setSearch] = useState("");
  const { state, reload } = useSellerProducts(filters);
  const { options } = useCategoryOptions();
  const categoryNames = useMemo(() => new Map(options.map((o) => [o.id, o.label])), [options]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setFilters((f) => ({ ...f, page: 1, q: search.trim() }));
  };

  const filtered = filters.q !== "" || filters.status !== "";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-h1">محصولات من</h1>
        <Link href="/seller/products/new" className={buttonClasses({ variant: "primary" })}>
          + افزودن محصول
        </Link>
      </header>

      <form role="search" onSubmit={submitSearch} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
        <Input
          label="جستجوی محصول"
          name="q"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          label="وضعیت"
          name="status"
          value={filters.status}
          onChange={(event) =>
            setFilters((f) => ({ ...f, page: 1, status: event.target.value as ProductStatus | "" }))
          }
        >
          <option value="">همه وضعیت‌ها</option>
          {(Object.keys(PRODUCT_STATUS_LABEL) as ProductStatus[]).map((status) => (
            <option key={status} value={status}>
              {PRODUCT_STATUS_LABEL[status]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          جستجو
        </Button>
      </form>

      {state.status === "loading" && <ListSkeleton />}
      {state.status === "error" && (
        <ErrorState description="دریافت محصولات انجام نشد." onRetry={reload} />
      )}
      {state.status === "forbidden" && (
        <EmptyState
          title="دسترسی به مدیریت محصولات ندارید"
          description={state.message}
          action={
            <Link href="/seller/application" className={buttonClasses({ variant: "primary" })}>
              وضعیت درخواست فروشندگی
            </Link>
          }
        />
      )}
      {state.status === "ready" &&
        (state.result.data.length === 0 ? (
          <EmptyState
            title={filtered ? "محصولی با این فیلتر پیدا نشد" : "هنوز محصولی ثبت نکرده‌اید"}
            description={
              filtered ? "جستجو یا فیلتر وضعیت را تغییر دهید." : "اولین محصول فروشگاه خود را اضافه کنید."
            }
            action={
              filtered ? undefined : (
                <Link href="/seller/products/new" className={buttonClasses({ variant: "primary" })}>
                  افزودن محصول
                </Link>
              )
            }
          />
        ) : (
          <>
            <div
              aria-hidden="true"
              className={`hidden px-4 text-xs text-ink-muted ${ROW_GRID}`}
            >
              <span>محصول</span>
              <span>دسته‌بندی</span>
              <span>قیمت</span>
              <span>وضعیت</span>
              <span>تاریخ ایجاد</span>
              <span>عملیات</span>
            </div>
            <ul aria-label="فهرست محصولات" className="flex flex-col gap-3">
              {state.result.data.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  categoryName={categoryNames.get(product.categoryId) ?? "—"}
                  onChanged={reload}
                />
              ))}
            </ul>
            <Pagination
              page={state.result.pagination.page}
              totalPages={state.result.pagination.totalPages}
              onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
            />
          </>
        ))}
    </div>
  );
}
