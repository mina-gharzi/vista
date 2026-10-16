"use client";

import { SELLER_STATUS_LABEL, type SellerStatus } from "@vista/shared";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Badge, Button, buttonClasses, Card, EmptyState, Input, Pagination } from "@/components/ui";
import { adminApi } from "@/lib/api/admin";
import { formatDate, formatNumber } from "@/lib/utils/format";
import { FilterChips, QueryBoundary } from "./AdminParts";
import { sellerStatusBadge } from "./adminLabels";
import { useAdminQuery } from "./useAdminQuery";

const STATUS_OPTIONS = [
  { value: "" as const, label: "همه" },
  ...(Object.keys(SELLER_STATUS_LABEL) as SellerStatus[]).map((s) => ({ value: s, label: SELLER_STATUS_LABEL[s] })),
];

export function AdminSellersView({ initialStatus = "" }: { initialStatus?: SellerStatus | "" }) {
  const [filters, setFilters] = useState<{ page: number; q: string; status: SellerStatus | "" }>({
    page: 1,
    q: "",
    status: initialStatus,
  });
  const [draft, setDraft] = useState("");
  const { state, reload } = useAdminQuery(
    () => adminApi.sellers({ page: filters.page, limit: 10, q: filters.q || undefined, status: filters.status || undefined }),
    JSON.stringify(filters),
  );
  const filtered = filters.q !== "" || filters.status !== "";

  const search = (event: FormEvent) => {
    event.preventDefault();
    setFilters((f) => ({ ...f, page: 1, q: draft.trim() }));
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="type-h1">فروشندگان</h1>
      </header>

      <form role="search" onSubmit={search} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <Input
            label="جستجو (نام فروشگاه، شناسه، نام یا ایمیل مالک)"
            name="q"
            autoComplete="off"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary">
          جستجو
        </Button>
        {filtered && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setDraft("");
              setFilters({ page: 1, q: "", status: "" });
            }}
          >
            پاک‌کردن
          </Button>
        )}
      </form>
      <FilterChips
        label="فیلتر وضعیت فروشنده"
        options={STATUS_OPTIONS}
        value={filters.status}
        onChange={(status) => setFilters((f) => ({ ...f, page: 1, status }))}
      />

      <QueryBoundary state={state} reload={reload} label="فروشندگان">
        {(result) =>
          result.data.length === 0 ? (
            <EmptyState
              title={filtered ? "فروشنده‌ای با این فیلتر پیدا نشد" : "هنوز فروشنده‌ای ثبت نشده است"}
              {...(filtered ? { description: "جستجو یا فیلتر را تغییر دهید." } : {})}
            />
          ) : (
            <>
              <ul aria-label="فهرست فروشندگان" className="flex flex-col gap-3">
                {result.data.map((s) => (
                  <li key={s.id}>
                    <Card as="article" padding="sm" className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <h2 className="font-medium">{s.storeName}</h2>
                        <p className="text-sm text-ink-muted" dir="ltr">
                          {s.ownerEmail}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {s.ownerName} · {formatNumber(s.productCount)} محصول · {formatDate(s.createdAt)}
                        </p>
                      </div>
                      <Badge variant={sellerStatusBadge[s.status]}>{SELLER_STATUS_LABEL[s.status]}</Badge>
                      <Link
                        href={`/admin/sellers/${s.id}`}
                        aria-label={`مشاهده ${s.storeName}`}
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
