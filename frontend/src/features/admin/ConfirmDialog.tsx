"use client";

import { useRef, useState } from "react";
import { Button, Modal, useToast } from "@/components/ui";
import { describeAdminError } from "./adminErrors";

interface Props {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  successMessage: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  /** وقتی داده کهنه است (409/404) */
  onStale?: () => void;
}

/** تأیید عملیات حساس: ارسال دوباره در حین درخواست غیرممکن است (Ref + state). */
export function ConfirmDialog({ title, description, confirmLabel, danger, successMessage, onConfirm, onClose, onStale }: Props) {
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
      await onConfirm();
      toast({ title: successMessage, variant: "success" });
      onClose();
    } catch (e) {
      const described = describeAdminError(e);
      setError(described.message);
      if (described.stale) onStale?.();
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
      title={title}
      description={description}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            انصراف
          </Button>
          <Button type="button" variant={danger ? "danger" : "primary"} loading={pending} disabled={pending} onClick={confirm}>
            {confirmLabel}
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
