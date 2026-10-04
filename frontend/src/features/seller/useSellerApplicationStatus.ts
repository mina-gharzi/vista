"use client";

import type { SellerApplicationStatus } from "@vista/shared";
import { useCallback, useEffect, useState } from "react";
import { sellerApi } from "@/lib/api/seller";

export type SellerStatusLoadState = "loading" | "error" | "ready";

/** خواندن وضعیت درخواست فروشندگی کاربر جاری (مشترک بین صفحه فرم و صفحه وضعیت). */
export function useSellerApplicationStatus() {
  const [state, setState] = useState<SellerStatusLoadState>("loading");
  const [data, setData] = useState<SellerApplicationStatus | null>(null);

  const load = useCallback(() => {
    setState("loading");
    sellerApi
      .getApplicationStatus()
      .then((result) => {
        setData(result);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  useEffect(load, [load]);

  return { state, data, reload: load };
}
