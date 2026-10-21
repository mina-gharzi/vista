"use client";

import type { CouponPreview } from "@vista/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { couponsApi } from "@/lib/api/coupons";
import { describeCouponError } from "./couponErrors";

const STORAGE_KEY = "vista:coupon";

/** فقط «کد» نگه داشته می‌شود (نه مبلغ)؛ همیشه از سرور دوباره محاسبه می‌شود. */
const storage = {
  read(): string | null {
    try {
      return window.sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },
  write(code: string): void {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* ذخیره‌سازی در دسترس نیست؛ فقط بین صفحه‌ها یادآوری نمی‌شود */
    }
  },
  clear(): void {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  },
};

export interface CouponController {
  input: string;
  setInput: (value: string) => void;
  /** نتیجهٔ آخرین پیش‌نمایش موفق سرور (یا null) */
  applied: CouponPreview | null;
  /** در حال اعمال کد جدید */
  applying: boolean;
  /** در حال بازمحاسبه بعد از تغییر سبد */
  revalidating: boolean;
  /** applying یا revalidating: تا پایان آن، مبلغ نمایش‌داده‌شده قطعی نیست */
  busy: boolean;
  /** خطای اعمال کد (زیر فیلد نمایش داده می‌شود) */
  error: string | null;
  /** کد قبلی بعد از تغییر سبد یا رد Checkout دیگر معتبر نبود */
  notice: string | null;
  apply: () => Promise<void>;
  remove: () => void;
  /** رد شدن کوپن توسط سرور (مثلاً در Checkout): کد حذف و پیام برای کاربر نگه داشته می‌شود */
  drop: (message: string) => void;
  /** بعد از ثبت موفق سفارش: فقط حافظهٔ مرورگر پاک می‌شود */
  clearStored: () => void;
}

/**
 * وضعیت کوپن سمت کاربر. منبع حقیقت «همیشه سرور» است:
 *  - اعمال/بازمحاسبه = POST /coupons/validate روی سبد فعلی سرور.
 *  - `cartKey` امضای محتوای سبد است؛ با هر تغییر (افزودن/حذف/تعداد) کوپن دوباره اعتبارسنجی می‌شود و اگر
 *    دیگر معتبر نباشد، حذف و دلیلش اعلام می‌شود (هیچ مبلغ کهنه‌ای نمایش داده نمی‌شود).
 *  - درخواست‌های کهنه (لغوشده/قدیمی‌تر) هرگز نتیجهٔ جدیدتر را بازنویسی نمی‌کنند.
 *  - ارسال تکراری (دو کلیک پشت‌سرهم) با Ref قبل از Render بعدی هم مسدود است.
 */
export function useCoupon(cartKey: string): CouponController {
  const [input, setInputState] = useState("");
  const [applied, setApplied] = useState<CouponPreview | null>(null);
  const [applying, setApplying] = useState(false);
  const [revalidating, setRevalidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const inFlight = useRef(false);
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const appliedRef = useRef<CouponPreview | null>(null);
  appliedRef.current = applied;

  const setInput = useCallback((value: string) => {
    setInputState(value);
    setError(null);
  }, []);

  const apply = useCallback(async () => {
    const code = input.trim();
    if (!code || inFlight.current) return;
    inFlight.current = true;
    const id = ++requestId.current;
    controller.current?.abort();
    controller.current = new AbortController();
    setApplying(true);
    setError(null);
    setNotice(null);
    try {
      const preview = await couponsApi.validate(code, controller.current.signal);
      if (id !== requestId.current) return;
      setApplied(preview);
      setInputState("");
      storage.write(preview.code);
    } catch (e) {
      if (id !== requestId.current || (e instanceof DOMException && e.name === "AbortError")) return;
      setError(describeCouponError(e).message);
    } finally {
      inFlight.current = false;
      if (id === requestId.current) setApplying(false);
    }
  }, [input]);

  const remove = useCallback(() => {
    requestId.current += 1;
    controller.current?.abort();
    storage.clear();
    setApplied(null);
    setError(null);
    setNotice(null);
    setRevalidating(false);
  }, []);

  const drop = useCallback((message: string) => {
    requestId.current += 1;
    controller.current?.abort();
    storage.clear();
    setApplied(null);
    setNotice(message);
    setRevalidating(false);
  }, []);

  const clearStored = useCallback(() => storage.clear(), []);

  // بازمحاسبه: بعد از هر تغییر سبد، یا در اولین بارگذاری اگر کدی از صفحهٔ قبل ذخیره شده است
  useEffect(() => {
    if (cartKey === "") return;
    // اگر هنوز کدی اعمال نشده، کدِ یادآوری‌شده از صفحهٔ قبل (سبد → Checkout) خوانده می‌شود؛
    // حذف/رد کوپن حافظه را پاک می‌کند، پس کد حذف‌شده دوباره زنده نمی‌شود.
    const code = appliedRef.current?.code ?? storage.read();
    if (!code) return;

    const id = ++requestId.current;
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    setRevalidating(true);
    couponsApi
      .validate(code, ctrl.signal)
      .then((preview) => {
        if (id !== requestId.current) return;
        setApplied(preview);
        setNotice(null);
        storage.write(preview.code);
      })
      .catch((e: unknown) => {
        if (id !== requestId.current || (e instanceof DOMException && e.name === "AbortError")) return;
        const described = describeCouponError(e);
        if (described.kind === "rule") {
          storage.clear();
          setApplied(null);
          setNotice(`کد تخفیف ${code} حذف شد: ${described.message}`);
        } else {
          // خطای موقت: کد را حذف نمی‌کنیم ولی مبلغ نمایش‌داده‌شده دیگر قطعی نیست
          setNotice(`${described.message} مبلغ تخفیف ممکن است به‌روز نباشد.`);
        }
      })
      .finally(() => {
        if (id === requestId.current) setRevalidating(false);
      });
    return () => ctrl.abort();
  }, [cartKey]);

  return {
    input,
    setInput,
    applied,
    applying,
    revalidating,
    busy: applying || revalidating,
    error,
    notice,
    apply,
    remove,
    drop,
    clearStored,
  };
}

/** امضای محتوای سبد؛ با هر تغییر کالا/تعداد عوض می‌شود. سبد خالی = رشتهٔ خالی. */
export function cartSignature(items: readonly { variantId: string; quantity: number }[]): string {
  return items.map((item) => `${item.variantId}:${item.quantity}`).sort().join("|");
}
