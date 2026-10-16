"use client";

import { PRODUCT_STATUS_LABEL, type ProductStatusValue } from "@vista/shared";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Badge, Button, buttonClasses, Card, Checkbox, EmptyState, Input, Pagination, Select } from "@/components/ui";
import { adminApi } from "@/lib/api/admin";
import { formatNumber, formatPrice } from "@/lib/utils/format";
import { FilterChips, QueryBoundary } from "./AdminParts";
import { productStatusBadge } from "./adminLabels";
import { useAdminQuery } from "./useAdminQuery";

interface Filters {
  page: number;
  q: string;
  status: ProductStatusValue | "";
  categoryId: string;
  sellerId: string;
  blockedOnly: boolean;
}

const STATUS_OPTIONS = [
  { value: "" as const, label: "همه" },
  ...(Object.keys(PRODUCT_STATUS_LABEL) as ProductStatusValue[]).map((s) => ({ value: s, label: PRODUCT_STATUS_LABEL[s] })),
];

export function AdminProductsView({ initialSellerId = "" }: { initialSellerId?: string }) {
  const [filters, setFilters] = useState<Filters>({
    page: 1,
    q: "",
    status: "",
    categoryId: "",
    sellerId: initialSellerId,
    blockedOnly: false,
  });
  const [draft, setDraft] = useState("");
  const categories = useAdminQuery(() => adminApi.categories({ sort: "name" }), "categories-options");
  const { state, reload } = useAdminQuery(
    () =>
      adminApi.products({
        page: filters.page,
        limit: 10,
        q: filters.q || undefined,
        status: filters.status || undefined,
        categoryId: filters.categoryId || undefined,
        sellerId: filters.sellerId || undefined,
        blockedSellers: filters.blockedOnly ? true : undefined,
      }),
    JSON.stringify(filters),
  );
  const filtered =
    filters.q !== "" || filters.status !== "" || filters.categoryId !== "" || filters.sellerId !== "" || filters.blockedOnly;

  const search = (event: FormEvent) => {
    event.preventDefault();
    setFilters((f) => ({ ...f, page: 1, q: draft.trim() }));
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="type-h1">محصولات</h1>
      </header>

      <form role="search" onSubmit={search} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.5fr_auto] lg:items-end">
        <Input label="جستجو (عنوان یا شناسه)" name="q" autoComplete="off" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <Select
          label="دسته‌بندی"
          name="categoryId"
          value={filters.categoryId}
          onChange={(e) => setFilters((f) => ({ ...f, page: 1, categoryId: e.target.value }))}
        >
          <option value="">همه</option>
          {categories.state.status === "ready" &&
            categories.state.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </Select>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary">
            جستجو
          </Button>
          {filtered && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDraft("");
                setFilters({ page: 1, q: "", status: "", categoryId: "", sellerId: "", blockedOnly: false });
              }}
            >
              پاک‌کردن
            </Button>
          )}
        </div>
      </form>
      <FilterChips
        label="فیلتر وضعیت محصول"
        options={STATUS_OPTIONS}
        value={filters.status}
        onChange={(status) => setFilters((f) => ({ ...f, page: 1, status }))}
      />
      <Checkbox
        label="فقط محصولات فروشندگان غیرفعال (تعلیق/ردشده/در انتظار)"
        checked={filters.blockedOnly}
        onChange={(e) => setFilters((f) => ({ ...f, page: 1, blockedOnly: e.target.checked }))}
      />
      {filters.sellerId && <p className="text-sm text-ink-muted">فیلتر فعال: محصولات یک فروشندهٔ مشخص</p>}

      <QueryBoundary state={state} reload={reload} label="محصولات">
        {(result) =>
          result.data.length === 0 ? (
            <EmptyState title={filtered ? "محصولی با این فیلتر پیدا نشد" : "هنوز محصولی ثبت نشده است"} />
          ) : (
            <>
              <ul aria-label="فهرست محصولات" className="flex flex-col gap-3">
                {result.data.map((p) => (
                  <li key={p.id}>
                    <Card as="article" padding="sm" className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <h2 className="font-medium">{p.title}</h2>
                        <p className="text-xs text-ink-muted">
                          {p.categoryName} · {p.sellerName} · {formatPrice(p.basePrice)} · موجودی {formatNumber(p.totalStock)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={productStatusBadge[p.status]}>{PRODUCT_STATUS_LABEL[p.status]}</Badge>
                        {p.sellerBlocked && <Badge variant="danger">فروشندهٔ غیرفعال</Badge>}
                      </div>
                      <Link
                        href={`/admin/products/${p.id}`}
                        aria-label={`مشاهده ${p.title}`}
                        className={buttonClasses({ variant: "secondary", size: "sm" })}
                      >
                        مشاهده و بررسی
                      </Link>
                    </Card>
                  </li>
                ))}
              </ul>
              <Pagination
                page={result.pagination.page}
                totalPages={result.pagination.totalPages}
                onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
              />
            </>
          )
        }
      </QueryBoundary>
    </div>
  );
}
