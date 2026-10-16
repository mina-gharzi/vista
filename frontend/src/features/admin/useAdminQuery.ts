"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiRequestError } from "@/lib/api/client";

export type AdminQueryState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "forbidden"; message: string }
  | { status: "notFound" }
  | { status: "error" };

/**
 * `key` (رشتهٔ سریال‌شدهٔ فیلترها) تعیین می‌کند چه زمانی دوباره خوانده شود. بازخوانی دستی (reload)
 * داده قبلی را تا رسیدن نتیجه نگه می‌دارد تا صفحه چشمک نزند.
 */
export function useAdminQuery<T>(fetcher: () => Promise<T>, key: string) {
  const [state, setState] = useState<AdminQueryState<T>>({ status: "loading" });
  const [version, setVersion] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (lastKey.current !== key) setState({ status: "loading" });
    lastKey.current = key;
    fetcherRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiRequestError && error.status === 403) {
          setState({ status: "forbidden", message: error.message });
        } else if (error instanceof ApiRequestError && error.status === 404) {
          setState({ status: "notFound" });
        } else {
          setState({ status: "error" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [key, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback((data: T) => setState({ status: "ready", data }), []);
  return { state, reload, setData };
}
