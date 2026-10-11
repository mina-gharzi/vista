"use client";

import type { FulfillmentStatus, SellerOrderListItem, SellerOrdersOverview } from "@vista/shared";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  buttonClasses,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Skeleton,
} from "@/components/ui";
import { fulfillmentStatusBadge, fulfillmentStatusLabel } from "@/features/orders/statusLabels";
import { toLatinDigits } from "@/lib/utils/digits";
import { formatDate, formatNumber, formatPrice } from "@/lib/utils/format";
import { useOrdersOverview, useSellerOrders, type OrderFilters } from "./useSellerOrders";

const ROW_GRID = "md:grid md:grid-cols-[1.5fr_2fr_1fr_2fr_2fr_2fr] md:items-center md:gap-4";
const CARD_STATUSES: FulfillmentStatus[] = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED"];
const FILTER_STATUSES: FulfillmentStatus[] = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

function OverviewCards({ overview }: { overview: SellerOrdersOverview }) {
  return (
    <section aria-label="خلاصه سفارش‌ها" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {CARD_STATUSES.map((status) => (
        <Card key={status} padding="sm" className="flex flex-col gap-1">
          <p className="text-sm text-ink-muted">{fulfillmentStatusLabel[status]}</p>
          <p className="type-h2 tabular-nums">{formatNumber(overview.byStatus[status].count)}</p>
          <p className="type-caption tabular-nums">{formatPrice(overview.byStatus[status].total)}</p>
        </Card>
      ))}
    </section>
  );
}

function OrderRow({ order }: { order: SellerOrderListItem }) {
  return (
    <li>
      <Card as="article" padding="sm" className={`flex flex-col gap-2 ${ROW_GRID}`}>
        <h3 className="font-medium tabular-nums">
          <span className="md:sr-only">شماره سفارش: </span>#{formatNumber(order.orderNumber)}
        </h3>
        <p className="text-sm text-ink-muted">
          <span className="md:sr-only">تاریخ: </span>
          {formatDate(order.createdAt)}
        </p>
        <p className="text-sm tabular-nums">
          <span className="md:sr-only">تعداد اقلام: </span>
          {formatNumber(order.itemCount)} عدد
        </p>
        <p className="text-sm tabular-nums">
          <span className="md:sr-only">مبلغ شما: </span>
          {formatPrice(order.subtotal)}
        </p>
        <div>
          <Badge variant={fulfillmentStatusBadge[order.status]}>{fulfillmentStatusLabel[order.status]}</Badge>
        </div>
        <div>
          <Link
            href={`/seller/orders/${order.id}`}
            aria-label={`مشاهده جزئیات سفارش ${formatNumber(order.orderNumber)}`}
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            مشاهده جزئیات
          </Link>
        </div>
      </Card>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div aria-busy="true" aria-label="در حال بارگذاری سفارش‌ها" className="flex flex-col gap-3">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}

const EMPTY_FILTERS: OrderFilters = { page: 1, status: "", q: "", from: "", to: "" };

export function SellerOrdersView() {
  const [filters, setFilters] = useState<OrderFilters>(EMPTY_FILTERS);
  const [draft, setDraft] = useState({ q: "", from: "", to: "" });
  const [formError, setFormError] = useState<{ q?: string; to?: string }>({});
  const { state, reload } = useSellerOrders(filters);
  const overview = useOrdersOverview();

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    const q = toLatinDigits(draft.q).trim();
    const errors: { q?: string; to?: string } = {};
    if (q !== "" && !/^\d{1,9}$/.test(q)) errors.q = "شماره سفارش باید فقط عدد باشد";
    if (draft.from && draft.to && draft.from > draft.to) errors.to = "تاریخ پایان نباید قبل از شروع باشد";
    setFormError(errors);
    if (errors.q || errors.to) return;
    setFilters((f) => ({ ...f, page: 1, q, from: draft.from, to: draft.to }));
  };

  const clearFilters = () => {
    setDraft({ q: "", from: "", to: "" });
    setFormError({});
    setFilters(EMPTY_FILTERS);
  };

  const filtered = filters.q !== "" || filters.status !== "" || filters.from !== "" || filters.to !== "";

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="type-h1">سفارش‌ها</h1>
      </header>

      {overview.state.status === "loading" && (
        <div aria-busy="true" aria-label="در حال بارگذاری خلاصه سفارش‌ها" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}
      {overview.state.status === "error" && (
        <ErrorState description="دریافت خلاصه سفارش‌ها انجام نشد." onRetry={overview.reload} className="py-6" />
      )}
      {overview.state.status === "ready" && <OverviewCards overview={overview.state.overview} />}

      <form role="search" onSubmit={applyFilters} noValidate className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.5fr_1.5fr_auto] lg:items-end">
        <Input
          label="شماره سفارش"
          name="q"
          inputMode="numeric"
          autoComplete="off"
          value={draft.q}
          onChange={(event) => setDraft((d) => ({ ...d, q: event.target.value }))}
          error={formError.q ?? ""}
        />
        <Input
          label="از تاریخ"
          name="from"
          type="date"
          dir="ltr"
          value={draft.from}
          onChange={(event) => setDraft((d) => ({ ...d, from: event.target.value }))}
        />
        <Input
          label="تا تاریخ"
          name="to"
          type="date"
          dir="ltr"
          value={draft.to}
          onChange={(event) => setDraft((d) => ({ ...d, to: event.target.value }))}
          error={formError.to ?? ""}
        />
        <div className="flex gap-2">
          <Button type="submit" variant="secondary">
            اعمال فیلتر
          </Button>
          {filtered && (
            <Button type="button" variant="ghost" onClick={clearFilters}>
              پاک‌کردن
            </Button>
          )}
        </div>
      </form>

      <div role="group" aria-label="فیلتر وضعیت سفارش" className="flex flex-wrap gap-2">
        {[{ value: "" as const, label: "همه" }, ...FILTER_STATUSES.map((s) => ({ value: s, label: fulfillmentStatusLabel[s] }))].map(
          (option) => {
            const active = filters.status === option.value;
            return (
              <button
                key={option.value || "all"}
                type="button"
                aria-pressed={active}
                onClick={() => setFilters((f) => ({ ...f, page: 1, status: option.value }))}
                className={`rounded-full border px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  active
                    ? "border-bordeaux bg-bordeaux text-ivory"
                    : "border-border bg-ivory text-ink hover:bg-ivory-soft"
                }`}
              >
                {option.label}
              </button>
            );
          },
        )}
      </div>

      {state.status === "loading" && <ListSkeleton />}
      {state.status === "error" && <ErrorState description="دریافت سفارش‌ها انجام نشد." onRetry={reload} />}
      {state.status === "forbidden" && (
        <EmptyState
          title="دسترسی به مدیریت سفارش‌ها ندارید"
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
            title={filtered ? "سفارشی با این فیلتر پیدا نشد" : "هنوز سفارشی ندارید"}
            description={
              filtered ? "جستجو یا فیلترها را تغییر دهید." : "سفارش‌های پرداخت‌شده مشتریان اینجا نمایش داده می‌شود."
            }
          />
        ) : (
          <>
            <div aria-hidden="true" className={`hidden px-4 text-xs text-ink-muted ${ROW_GRID}`}>
              <span>شماره سفارش</span>
              <span>تاریخ</span>
              <span>تعداد اقلام</span>
              <span>مبلغ شما</span>
              <span>وضعیت</span>
              <span>عملیات</span>
            </div>
            <ul aria-label="فهرست سفارش‌ها" className="flex flex-col gap-3">
              {state.result.data.map((order) => (
                <OrderRow key={order.id} order={order} />
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
