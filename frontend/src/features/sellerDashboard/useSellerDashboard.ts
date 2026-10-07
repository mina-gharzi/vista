"use client";

import type { SellerDashboard } from "@vista/shared";
import { useCallback, useEffect, useState } from "react";
import { ApiRequestError } from "@/lib/api/client";
import { sellerDashboardApi } from "@/lib/api/sellerDashboard";

export type SellerDashboardState =
  | { status: "loading" }
  | { status: "ready"; data: SellerDashboard }
  /** 403: کاربر فروشنده تأییدشده نیست (پیام فارسی Backend امن و قابل نمایش است) */
  | { status: "forbidden"; message: string }
  | { status: "error" };

export function useSellerDashboard() {
  const [state, setState] = useState<SellerDashboardState>({ status: "loading" });

  const load = useCallback(() => {
    setState({ status: "loading" });
    sellerDashboardApi
      .get()
      .then((data) => setState({ status: "ready", data }))
      .catch((error: unknown) => {
        if (error instanceof ApiRequestError && error.status === 403) {
          setState({ status: "forbidden", message: error.message });
        } else {
          setState({ status: "error" });
        }
      });
  }, []);

  useEffect(load, [load]);

  return { state, reload: load };
}
