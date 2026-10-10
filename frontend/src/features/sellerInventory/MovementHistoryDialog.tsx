"use client";

import type { InventoryItem, InventoryMovementEntry } from "@vista/shared";
import { useState } from "react";
import { Badge, Button, EmptyState, ErrorState, Modal, Pagination, Skeleton } from "@/components/ui";
import { formatNumber } from "@/lib/utils/format";
import { formatDateTime, formatDelta, MOVEMENT_TYPE_LABEL } from "./inventoryLabels";
import { useVariantMovements } from "./useSellerInventory";

function MovementRow({ movement }: { movement: InventoryMovementEntry }) {
  const delta = movement.quantityDelta;
  return (
    <li className="rounded border border-border bg-ivory p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="neutral">{MOVEMENT_TYPE_LABEL[movement.type]}</Badge>
        <time dateTime={movement.createdAt} className="text-ink-muted">
          {formatDateTime(movement.createdAt)}
        </time>
      </div>
      <p className="mt-2 tabular-nums">
        <span className="text-ink-muted">تغییر: </span>
        <strong dir="ltr" className={delta < 0 ? "text-danger" : "text-success"}>
          {formatDelta(delta)}
        </strong>
        <span className="mx-2 text-ink-muted">·</span>
        <span className="text-ink-muted">موجودی: </span>
        {formatNumber(movement.stockBefore)} ← {formatNumber(movement.stockAfter)}
      </p>
      {movement.reason && (
        <p className="mt-1">
          <span className="text-ink-muted">دلیل: </span>
          {movement.reason}
        </p>
      )}
      {movement.actorName && (
        <p className="text-ink-muted">
          ثبت‌کننده: <span className="text-ink">{movement.actorName}</span>
        </p>
      )}
    </li>
  );
}

export function MovementHistoryDialog({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const { state, reload } = useVariantMovements(item.variantId, page);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="تاریخچه موجودی"
      description={`${item.productTitle} — ${item.color} / ${item.size} (${item.sku})`}
      footer={
        <Button type="button" variant="secondary" onClick={onClose}>
          بستن
        </Button>
      }
    >
      {state.status === "loading" && (
        <div aria-busy="true" aria-label="در حال بارگذاری تاریخچه" className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}
      {state.status === "error" && (
        <ErrorState description="دریافت تاریخچه انجام نشد." onRetry={reload} />
      )}
      {state.status === "ready" &&
        (state.result.data.length === 0 ? (
          <EmptyState title="هنوز تغییری ثبت نشده است" />
        ) : (
          <div className="flex flex-col gap-3">
            <ul aria-label="حرکت‌های موجودی" className="flex flex-col gap-2">
              {state.result.data.map((movement) => (
                <MovementRow key={movement.id} movement={movement} />
              ))}
            </ul>
            <Pagination
              page={state.result.pagination.page}
              totalPages={state.result.pagination.totalPages}
              onPageChange={setPage}
            />
          </div>
        ))}
    </Modal>
  );
}
