"use client";

import type { OrderStatus } from "@vista/shared";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Badge, Button, buttonClasses, Card, EmptyState, Input, Pagination } from "@/components/ui";
import {
  fulfillmentStateBadge,
  fulfillmentStateLabel,
  orderStatusBadge,
  orderStatusLabel,
} from "@/features/orders/statusLabels";
import { adminApi } from "@/lib/api/admin";
import { toLatinDigits } from "@/lib/utils/digits";
import { formatDate, formatNumber, formatPrice } from "@/lib/utils/format";
import { FilterChips, QueryBoundary } from "./AdminParts";
import { useAdminQuery } from "./useAdminQuery";

interface Filters {
  page: number;
  q: string;
  status: OrderStatus | "";
  from: string;
  to: string;
}
const EMPTY: Filters = { page: 1, q: "", status: "", from: "", to: "" };

const STATUS_OPTIONS = [
  { value: "" as const, label: "همه" },
  ...(Object.keys(orderStatusLabel) as OrderStatus[]).map((s) => ({ value: s, label: orderStatusLabel[s] })),
];

export function AdminOrdersView() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [draft, setDraft] = useState({ q: "", from: "", to: "" });
  const [dateError, setDateError] = useState("");
  const { state, reload } = useAdminQuery(
    () =>
      adminApi.orders({
        page: filters.page,
        limit: 10,
        q: filters.q || undefined,
        status: filters.status || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      }),
    JSON.stringify(filters),
  );
  const filtered = filters.q !== "" || filters.status !== "" || filters.from !== "" || filters.to !== "";

  const apply = (event: FormEvent) => {
    event.preventDefault();
    if (draft.from && draft.to && draft.from > draft.to) {
      setDateError("تاریخ پایان نباید قبل از شروع باشد");
      return;
    }
    setDateError("");
    setFilters((f) => ({ ...f, page: 1, q: toLatinDigits(draft.q).trim(), from: draft.from, to: draft.to }));
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="type-h1">سفارش‌ها</h1>
        <p className="type-caption">فقط مشاهده؛ تغییر وضعیت پرداخت یا بازپرداخت از این بخش ممکن نیست.</p>
      </header>

      <form role="search" onSubmit={apply} noValidate className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.5fr_1.5fr_auto] lg:items-end">
        <Input
          label="شماره سفارش یا شناسه"
          name="q"
          autoComplete="off"
          value={draft.q}
          onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
        />
        <Input label="از تاریخ" name="from" type="date" dir="ltr" value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} />
        <Input label="تا تاریخ" name="to" type="date" dir="ltr" value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} error={dateError} />
        <div className="flex gap-2">
          <Button type="submit" variant="secondary">
            اعمال فیلتر
          </Button>
          {filtered && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDraft({ q: "", from: "", to: "" });
                setDateError("");
                setFilters(EMPTY);
              }}
            >
              پاک‌کردن
            </Button>
          )}
        </div>
      </form>
      <FilterChips
        label="فیلتر وضعیت پرداخت"
        options={STATUS_OPTIONS}
        value={filters.status}
        onChange={(status) => setFilters((f) => ({ ...f, page: 1, status }))}
      />

      <QueryBoundary state={state} reload={reload} label="سفارش‌ها">
        {(result) =>
          result.data.length === 0 ? (
            <EmptyState title={filtered ? "سفارشی با این فیلتر پیدا نشد" : "هنوز سفارشی ثبت نشده است"} />
          ) : (
            <>
              <ul aria-label="فهرست سفارش‌ها" className="flex flex-col gap-3">
                {result.data.map((o) => (
                  <li key={o.id}>
                    <Card as="article" padding="sm" className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-col gap-0.5">
                        <h2 className="font-medium tabular-nums">#{formatNumber(o.orderNumber)}</h2>
                        <p className="text-xs text-ink-muted">
                          {o.customerName} · {formatNumber(o.sellerCount)} فروشنده · {formatDate(o.createdAt)}
                        </p>
                      </div>
                      <span className="tabular-nums">{formatPrice(o.totalAmount)}</span>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={orderStatusBadge[o.status]}>{orderStatusLabel[o.status]}</Badge>
                        {o.status !== "CANCELLED" && (
                          <Badge variant={fulfillmentStateBadge[o.fulfillment.state]}>{fulfillmentStateLabel[o.fulfillment.state]}</Badge>
                        )}
                      </div>
                      <Link
                        href={`/admin/orders/${o.id}`}
                        aria-label={`مشاهده سفارش ${formatNumber(o.orderNumber)}`}
                        className={buttonClasses({ variant: "secondary", size: "sm" })}
                      >
                        مشاهده جزئیات
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
