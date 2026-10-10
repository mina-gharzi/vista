"use client";

import type { InventoryMovementsResult, SellerInventoryList, StockStatus } from "@vista/shared";
import { useCallback, useEffect, useState } from "react";
import { ApiRequestError } from "@/lib/api/client";
import { sellerInventoryApi } from "@/lib/api/sellerInventory";

export type SellerInventoryState =
  | { status: "loading" }
  | { status: "ready"; result: SellerInventoryList }
  | { status: "forbidden"; message: string }
  | { status: "error" };

export interface InventoryFilters {
  page: number;
  status: StockStatus | "";
  q: string;
}

export function useSellerInventory(filters: InventoryFilters) {
  const [state, setState] = useState<SellerInventoryState>({ status: "loading" });
  const [version, setVersion] = useState(0);
  const { page, status, q } = filters;

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    sellerInventoryApi
      .list({ page, limit: 10, status: status || undefined, q: q || undefined })
      .then((result) => {
        if (!cancelled) setState({ status: "ready", result });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiRequestError && error.status === 403) {
          setState({ status: "forbidden", message: error.message });
        } else {
          setState({ status: "error" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [page, status, q, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { state, reload };
}

export type MovementsState =
  | { status: "loading" }
  | { status: "ready"; result: InventoryMovementsResult }
  | { status: "error" };

export function useVariantMovements(variantId: string, page: number) {
  const [state, setState] = useState<MovementsState>({ status: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    sellerInventoryApi
      .movements(variantId, { page, limit: 10 })
      .then((result) => {
        if (!cancelled) setState({ status: "ready", result });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [variantId, page, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { state, reload };
}
