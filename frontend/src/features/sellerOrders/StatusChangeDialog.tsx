"use client";

import {
  updateSellerOrderStatusSchema,
  type SellerFulfillmentTarget,
  type SellerOrderDetail,
} from "@vista/shared";
import { useRef, useState, type FormEvent } from "react";
import { Button, Input, Modal, useToast } from "@/components/ui";
import { fulfillmentStatusLabel } from "@/features/orders/statusLabels";
import { sellerOrdersApi } from "@/lib/api/sellerOrders";
import { toLatinDigits } from "@/lib/utils/digits";
import { formatNumber } from "@/lib/utils/format";
import { firstFieldErrors } from "@/lib/utils/zod";
import { describeOrderError } from "./orderErrors";

export const TRANSITION_ACTION_LABEL: Record<SellerFulfillmentTarget, string> = {
  PROCESSING: "شروع آماده‌سازی",
  SHIPPED: "ثبت ارسال",
  DELIVERED: "ثبت تحویل",
};

const CONFIRM_TEXT: Record<SellerFulfillmentTarget, string> = {
  PROCESSING: "سفارش به «در حال آماده‌سازی» تغییر می‌کند.",
  SHIPPED: "پس از ثبت ارسال، این تغییر برگشت‌پذیر نیست و مشتری از وضعیت ارسال مطلع می‌شود.",
  DELIVERED: "سفارش به «تحویل‌شده» تغییر می‌کند و این تغییر برگشت‌پذیر نیست.",
};

interface Props {
  order: SellerOrderDetail;
  target: SellerFulfillmentTarget;
  onClose: () => void;
  /** بعد از موفقیت با سفارش به‌روز */
  onUpdated: (order: SellerOrderDetail) => void;
  /** وقتی داده کهنه است (409/404) و باید از سرور دوباره خوانده شود */
  onStale: () => void;
}

export function StatusChangeDialog({ order, target, onClose, onUpdated, onStale }: Props) {
  const { toast } = useToast();
  const [trackingCode, setTrackingCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Ref علاوه بر state: دو کلیک پشت‌سرهم قبل از Render بعدی هم فقط یک درخواست می‌سازد
  const inFlight = useRef(false);
  const needsTracking = target === "SHIPPED";
  const formId = `status-form-${target}`;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    setFormError(null);

    const candidate = needsTracking
      ? { status: target, trackingCode: toLatinDigits(trackingCode).trim() }
      : { status: target };
    const parsed = updateSellerOrderStatusSchema.safeParse(candidate);
    if (!parsed.success) {
      const fieldErrors = firstFieldErrors(parsed.error);
      if (needsTracking && trackingCode.trim() === "") fieldErrors.trackingCode = "کد رهگیری الزامی است";
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    inFlight.current = true;
    setPending(true);
    try {
      const updated = await sellerOrdersApi.updateStatus(order.id, parsed.data);
      toast({
        title: "وضعیت سفارش به‌روز شد",
        description: `وضعیت جدید: ${fulfillmentStatusLabel[updated.status]}`,
        variant: "success",
      });
      onUpdated(updated);
      onClose();
    } catch (error) {
      const described = describeOrderError(error);
      if (described.conflict || described.fatal) {
        // داده صفحه کهنه است: پیام را نشان می‌دهیم، دیالوگ را می‌بندیم و وضعیت واقعی را از سرور می‌گیریم
        toast({ title: described.message, variant: "error" });
        onStale();
        onClose();
      } else {
        setErrors(described.fieldErrors);
        setFormError(described.message);
      }
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => {
        if (!inFlight.current) onClose();
      }}
      title={TRANSITION_ACTION_LABEL[target]}
      description={`سفارش ${formatNumber(order.orderNumber)} — ${CONFIRM_TEXT[target]}`}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            انصراف
          </Button>
          <Button type="submit" form={formId} loading={pending} disabled={pending}>
            تأیید
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
        {formError && (
          <p role="alert" className="rounded border border-danger bg-danger-tint p-3 text-sm text-danger">
            {formError}
          </p>
        )}
        {needsTracking && (
          <Input
            label="کد رهگیری مرسوله"
            name="trackingCode"
            dir="ltr"
            autoComplete="off"
            required
            value={trackingCode}
            onChange={(event) => setTrackingCode(event.target.value)}
            error={errors.trackingCode ?? ""}
            hint="کد پستی یا کد رهگیری شرکت حمل‌ونقل؛ برای مشتری نمایش داده می‌شود."
          />
        )}
      </form>
    </Modal>
  );
}
