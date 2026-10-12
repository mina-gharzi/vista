"use client";

import type { OrderDetail } from "@vista/shared";
import { useRef, useState } from "react";
import { Button, Modal, useToast } from "@/components/ui";
import { ApiRequestError } from "@/lib/api/client";
import { ordersApi } from "@/lib/api/orders";
import { formatNumber } from "@/lib/utils/format";

interface Props {
  order: OrderDetail;
  onClose: () => void;
  onCancelled: (order: OrderDetail) => void;
  /** داده کهنه است (۴۰۹/۴۰۴): باید وضعیت واقعی از سرور خوانده شود */
  onStale: () => void;
}

function describeCancelError(error: unknown): { message: string; stale: boolean } {
  if (error instanceof ApiRequestError) {
    if (error.code === "NETWORK_ERROR") return { message: error.message, stale: false };
    if (error.status === 401) return { message: "نشست شما منقضی شده است. دوباره وارد شوید.", stale: false };
    if (error.status === 409 || error.status === 404) return { message: error.message, stale: true };
  }
  return { message: "لغو سفارش انجام نشد. لطفاً دوباره تلاش کنید.", stale: false };
}

export function CancelOrderDialog({ order, onClose, onCancelled, onStale }: Props) {
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const confirm = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const updated = await ordersApi.cancel(order.id);
      toast({ title: "سفارش لغو شد", variant: "success" });
      onCancelled(updated);
      onClose();
    } catch (caught) {
      const described = describeCancelError(caught);
      if (described.stale) {
        toast({ title: described.message, variant: "error" });
        onStale();
        onClose();
      } else {
        setError(described.message);
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
      title="لغو سفارش"
      description={`سفارش #${formatNumber(order.orderNumber)} به‌طور کامل لغو می‌شود و کالاها به انبار برمی‌گردند. این کار قابل بازگشت نیست.`}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            انصراف
          </Button>
          <Button type="button" loading={pending} disabled={pending} onClick={confirm}>
            بله، سفارش لغو شود
          </Button>
        </>
      }
    >
      {error && (
        <p role="alert" className="rounded border border-danger bg-danger-tint p-3 text-sm text-danger">
          {error}
        </p>
      )}
    </Modal>
  );
}
