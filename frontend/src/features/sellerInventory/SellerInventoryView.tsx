"use client";

import type { InventoryItem, InventorySummary, StockStatus } from "@vista/shared";
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
import { formatNumber } from "@/lib/utils/format";
import { formatDateTime, STOCK_STATUS_LABEL, STOCK_STATUS_VARIANT } from "./inventoryLabels";
import { MovementHistoryDialog } from "./MovementHistoryDialog";
import { StockChangeDialog, type StockChangeMode } from "./StockChangeDialog";
import { useSellerInventory, type InventoryFilters } from "./useSellerInventory";

const ROW_GRID = "md:grid md:grid-cols-[3fr_2fr_1.5fr_1fr_1.5fr_2fr_3fr] md:items-center md:gap-4";

type Dialog = { kind: StockChangeMode | "history"; item: InventoryItem } | null;

function SummaryCards({ summary }: { summary: InventorySummary }) {
  const cells = [
    { label: "کل تنوع‌ها", value: summary.totalVariants },
    { label: "جمع واحد موجود", value: summary.totalUnits },
    { label: `رو به اتمام (≤ ${formatNumber(summary.lowStockThreshold)})`, value: summary.lowStockCount },
    { label: "ناموجود", value: summary.outOfStockCount },
  ];
  return (
    <section aria-label="خلاصه موجودی" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cells.map((cell) => (
        <Card key={cell.label} padding="sm" className="flex flex-col gap-1">
          <p className="text-sm text-ink-muted">{cell.label}</p>
          <p className="type-h2 tabular-nums">{formatNumber(cell.value)}</p>
        </Card>
      ))}
    </section>
  );
}

function InventoryRow({ item, onAction }: { item: InventoryItem; onAction: (d: NonNullable<Dialog>) => void }) {
  const archived = item.productStatus === "ARCHIVED";
  return (
    <li>
      <Card as="article" padding="sm" className={`flex flex-col gap-2 ${ROW_GRID}`}>
        <h3 className="font-medium">{item.productTitle}</h3>
        <p className="text-sm text-ink-muted">
          <span className="md:sr-only">تنوع: </span>
          {item.color} / {item.size}
        </p>
        <p className="text-sm tabular-nums" dir="ltr" style={{ textAlign: "start" }}>
          <span className="md:sr-only">SKU: </span>
          {item.sku}
        </p>
        <p className="tabular-nums">
          <span className="text-sm text-ink-muted md:sr-only">موجودی: </span>
          <strong>{formatNumber(item.stock)}</strong>
        </p>
        <div>
          <Badge variant={STOCK_STATUS_VARIANT[item.status]}>{STOCK_STATUS_LABEL[item.status]}</Badge>
        </div>
        <p className="text-sm text-ink-muted">
          <span className="md:sr-only">آخرین تغییر: </span>
          {item.lastMovementAt ? formatDateTime(item.lastMovementAt) : "—"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={archived}
            aria-label={`افزایش موجودی ${item.productTitle} ${item.color} ${item.size}`}
            onClick={() => onAction({ kind: "restock", item })}
          >
            افزایش
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={archived}
            aria-label={`اصلاح موجودی ${item.productTitle} ${item.color} ${item.size}`}
            onClick={() => onAction({ kind: "adjust", item })}
          >
            اصلاح
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`تاریخچه ${item.productTitle} ${item.color} ${item.size}`}
            onClick={() => onAction({ kind: "history", item })}
          >
            تاریخچه
          </Button>
        </div>
      </Card>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div aria-busy="true" aria-label="در حال بارگذاری موجودی" className="flex flex-col gap-3">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}

const STATUS_FILTERS: { value: StockStatus | ""; label: string }[] = [
  { value: "", label: "همه" },
  { value: "IN_STOCK", label: STOCK_STATUS_LABEL.IN_STOCK },
  { value: "LOW_STOCK", label: STOCK_STATUS_LABEL.LOW_STOCK },
  { value: "OUT_OF_STOCK", label: STOCK_STATUS_LABEL.OUT_OF_STOCK },
];

export function SellerInventoryView() {
  const [filters, setFilters] = useState<InventoryFilters>({ page: 1, status: "", q: "" });
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const { state, reload } = useSellerInventory(filters);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setFilters((f) => ({ ...f, page: 1, q: search.trim() }));
  };
  const filtered = filters.q !== "" || filters.status !== "";
  const closeDialog = () => setDialog(null);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-h1">موجودی انبار</h1>
      </header>

      {state.status === "ready" && <SummaryCards summary={state.result.summary} />}

      <form role="search" onSubmit={submitSearch} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Input
          label="جستجو (محصول، SKU، رنگ، سایز)"
          name="q"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button type="submit" variant="secondary">
          جستجو
        </Button>
      </form>

      <div role="group" aria-label="فیلتر وضعیت موجودی" className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((option) => {
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
        })}
      </div>

      {state.status === "loading" && <ListSkeleton />}
      {state.status === "error" && <ErrorState description="دریافت موجودی انجام نشد." onRetry={reload} />}
      {state.status === "forbidden" && (
        <EmptyState
          title="دسترسی به مدیریت موجودی ندارید"
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
            title={filtered ? "موردی با این فیلتر پیدا نشد" : "هنوز تنوعی برای مدیریت موجودی ندارید"}
            description={
              filtered ? "جستجو یا فیلتر را تغییر دهید." : "ابتدا برای یک محصول تنوع (رنگ و سایز) تعریف کنید."
            }
            action={
              filtered ? undefined : (
                <Link href="/seller/products" className={buttonClasses({ variant: "primary" })}>
                  رفتن به محصولات
                </Link>
              )
            }
          />
        ) : (
          <>
            <div aria-hidden="true" className={`hidden px-4 text-xs text-ink-muted ${ROW_GRID}`}>
              <span>محصول</span>
              <span>تنوع</span>
              <span>SKU</span>
              <span>موجودی</span>
              <span>وضعیت</span>
              <span>آخرین تغییر</span>
              <span>عملیات</span>
            </div>
            <ul aria-label="فهرست موجودی" className="flex flex-col gap-3">
              {state.result.data.map((item) => (
                <InventoryRow key={item.variantId} item={item} onAction={setDialog} />
              ))}
            </ul>
            <Pagination
              page={state.result.pagination.page}
              totalPages={state.result.pagination.totalPages}
              onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
            />
          </>
        ))}

      {dialog && dialog.kind !== "history" && (
        <StockChangeDialog item={dialog.item} mode={dialog.kind} onClose={closeDialog} onDone={reload} />
      )}
      {dialog?.kind === "history" && <MovementHistoryDialog item={dialog.item} onClose={closeDialog} />}
    </div>
  );
}
