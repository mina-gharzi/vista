"use client";

import type { PaginatedResponse, ProductStatus, SellerProduct } from "@vista/shared";
import { useCallback, useEffect, useState } from "react";
import { ApiRequestError } from "@/lib/api/client";
import { sellerProductsApi } from "@/lib/api/sellerProducts";

export type SellerProductsState =
  | { status: "loading" }
  | { status: "ready"; result: PaginatedResponse<SellerProduct> }
  | { status: "forbidden"; message: string }
  | { status: "error" };

export interface ProductFilters {
  page: number;
  status: ProductStatus | "";
  q: string;
}

export function useSellerProducts(filters: ProductFilters) {
  const [state, setState] = useState<SellerProductsState>({ status: "loading" });
  const [version, setVersion] = useState(0);
  const { page, status, q } = filters;

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    sellerProductsApi
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
