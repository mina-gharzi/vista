"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button, Modal, Textarea, useToast } from "@/components/ui";
import { describeAdminError } from "./adminErrors";

export type ReasonValidation = { ok: true } | { ok: false; error: string };

interface Props {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  /** برچسب فیلد دلیل؛ اگر لازم نباشد (reasonRequired=false) فیلد نمایش داده نمی‌شود */
  reasonRequired: boolean;
  validate: (reason: string) => ReasonValidation;
  successMessage: string;
  onSubmit: (reason: string) => Promise<void>;
  onClose: () => void;
  onStale: () => void;
}

/** دیالوگ تغییر وضعیت با «دلیل» (رد/تعلیق فروشنده، لغو انتشار/بایگانی محصول). */
export function ReasonDialog(props: Props) {
  const { title, description, confirmLabel, danger, reasonRequired, validate, successMessage, onSubmit, onClose, onStale } = props;
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const formId = "admin-reason-form";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    setFormError(null);
    const trimmed = reason.trim();
    const check = validate(trimmed);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError(null);
    inFlight.current = true;
    setPending(true);
    try {
      await onSubmit(trimmed);
      toast({ title: successMessage, variant: "success" });
      onClose();
    } catch (e) {
      const described = describeAdminError(e);
      if (described.stale) {
        toast({ title: described.message, variant: "error" });
        onStale();
        onClose();
      } else {
        setError(described.fieldErrors.reason ?? null);
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
      title={title}
      description={description}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            انصراف
          </Button>
          <Button type="submit" form={formId} variant={danger ? "danger" : "primary"} loading={pending} disabled={pending}>
            {confirmLabel}
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
        {reasonRequired && (
          <Textarea
            label="دلیل"
            name="reason"
            required
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            error={error ?? ""}
            hint="دلیل در سابقهٔ ممیزی ثبت می‌شود."
          />
        )}
      </form>
    </Modal>
  );
}
