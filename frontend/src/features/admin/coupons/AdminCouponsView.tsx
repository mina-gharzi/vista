"use client";

import { COUPON_STATE_LABEL } from "@vista/shared";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Badge, Button, buttonClasses, Card, EmptyState, Input, Pagination } from "@/components/ui";
import { adminApi } from "@/lib/api/admin";
import { formatDate, formatNumber, formatPrice } from "@/lib/utils/format";
import { FilterChips, QueryBoundary } from "../AdminParts";
import { useAdminQuery } from "../useAdminQuery";
import { couponStateBadge, describeDiscount } from "./couponLabels";

type ActiveFilter = "" | "true" | "false";

const ACTIVE_OPTIONS: { value: ActiveFilter; label: string }[] = [
  { value: "", label: "همه" },
  { value: "true", label: "فعال" },
  { value: "false", label: "غیرفعال" },
];

export function AdminCouponsView() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [active, setActive] = useState<ActiveFilter>("");

  const { state, reload } = useAdminQuery(
    () =>
      adminApi.coupons({
        page,
        limit: 10,
        q: q || undefined,
        isActive: active === "" ? undefined : active === "true",
      }),
    JSON.stringify({ page, q, active }),
  );
  const filtered = q !== "" || active !== "";

  const search = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setQ(draft.trim());
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-h1">کوپن‌ها</h1>
        <Link href="/admin/coupons/new" className={buttonClasses({ variant: "primary", size: "md" })}>
          کوپن جدید
        </Link>
      </header>

      <form role="search" onSubmit={search} className="grid gap-3 sm:grid-cols-[2fr_auto] sm:items-end">
        <Input label="جستجو در کد کوپن" name="q" autoComplete="off" dir="ltr" value={draft} onChange={(e) => setDraft(e.target.value)} />
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
                setQ("");
                setActive("");
                setPage(1);
              }}
            >
              پاک‌کردن
            </Button>
          )}
        </div>
      </form>
      <FilterChips
        label="فیلتر فعال‌سازی"
        options={ACTIVE_OPTIONS}
        value={active}
        onChange={(value) => {
          setPage(1);
          setActive(value as ActiveFilter);
        }}
      />

      <QueryBoundary state={state} reload={reload} label="کوپن‌ها">
        {(result) =>
          result.data.length === 0 ? (
            <EmptyState title={filtered ? "کوپنی با این فیلتر پیدا نشد" : "هنوز کوپنی ساخته نشده است"} />
          ) : (
            <>
              <ul aria-label="فهرست کوپن‌ها" className="flex flex-col gap-3">
                {result.data.map((c) => (
                  <li key={c.id}>
                    <Card as="article" padding="sm" className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <h2 className="font-medium" dir="ltr">
                          {c.code}
                        </h2>
                        <p className="text-xs text-ink-muted">
                          {describeDiscount(c.discountType, c.discountValue)}
                          {c.minPurchaseAmount !== null && ` · حداقل خرید ${formatPrice(c.minPurchaseAmount)}`}
                          {c.sellerName && ` · ${c.sellerName}`}
                          {c.expiresAt && ` · تا ${formatDate(c.expiresAt)}`}
                          {` · استفاده ${formatNumber(c.usedCount)}${c.usageLimit !== null ? ` از ${formatNumber(c.usageLimit)}` : ""}`}
                        </p>
                      </div>
                      <Badge variant={couponStateBadge[c.state]}>{COUPON_STATE_LABEL[c.state]}</Badge>
                      <Link
                        href={`/admin/coupons/${c.id}`}
                        aria-label={`مشاهده ${c.code}`}
                        className={buttonClasses({ variant: "secondary", size: "sm" })}
                      >
                        مشاهده و ویرایش
                      </Link>
                    </Card>
                  </li>
                ))}
              </ul>
              <Pagination
                page={result.pagination.page}
                totalPages={result.pagination.totalPages}
                onPageChange={setPage}
              />
            </>
          )
        }
      </QueryBoundary>
    </div>
  );
}
