"use client";

import type {
  FulfillmentStatus,
  SellerOrderDetail,
  SellerOrderList,
  SellerOrdersOverview,
} from "@vista/shared";
import { useCallback, useEffect, useState } from "react";
import { ApiRequestError } from "@/lib/api/client";
import { sellerOrdersApi } from "@/lib/api/sellerOrders";

export interface OrderFilters {
  page: number;
  status: FulfillmentStatus | "";
  q: string;
  from: string;
  to: string;
}

export type SellerOrdersState =
  | { status: "loading" }
  | { status: "ready"; result: SellerOrderList }
  | { status: "forbidden"; message: string }
  | { status: "error" };

export function useSellerOrders(filters: OrderFilters) {
  const [state, setState] = useState<SellerOrdersState>({ status: "loading" });
  const [version, setVersion] = useState(0);
  const { page, status, q, from, to } = filters;

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    sellerOrdersApi
      .list({
        page,
        limit: 10,
        status: status || undefined,
        q: q || undefined,
        from: from || undefined,
        to: to || undefined,
      })
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
  }, [page, status, q, from, to, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { state, reload };
}

export type OverviewState =
  | { status: "loading" }
  | { status: "ready"; overview: SellerOrdersOverview }
  | { status: "error" };

export function useOrdersOverview() {
  const [state, setState] = useState<OverviewState>({ status: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    sellerOrdersApi
      .overview()
      .then((overview) => {
        if (!cancelled) setState({ status: "ready", overview });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { state, reload };
}

export type OrderDetailState =
  | { status: "loading" }
  | { status: "ready"; order: SellerOrderDetail }
  | { status: "notFound" }
  | { status: "forbidden"; message: string }
  | { status: "error" };

export function useSellerOrderDetail(sellerOrderId: string) {
  const [state, setState] = useState<OrderDetailState>({ status: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // بازخوانی بعد از تغییر/تداخل، صفحه را به «در حال بارگذاری» برنمی‌گرداند تا چشمک نزند
    if (version === 0) setState({ status: "loading" });
    sellerOrdersApi
      .detail(sellerOrderId)
      .then((order) => {
        if (!cancelled) setState({ status: "ready", order });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiRequestError && error.status === 404) setState({ status: "notFound" });
        else if (error instanceof ApiRequestError && error.status === 403) {
          setState({ status: "forbidden", message: error.message });
        } else setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [sellerOrderId, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setOrder = useCallback((order: SellerOrderDetail) => setState({ status: "ready", order }), []);
  return { state, reload, setOrder };
}
