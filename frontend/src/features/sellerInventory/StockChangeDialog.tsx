"use client";

import {
  adjustStockSchema,
  restockSchema,
  type InventoryItem,
} from "@vista/shared";
import { useRef, useState, type FormEvent } from "react";
import { Button, Input, Modal, Select, Textarea, useToast } from "@/components/ui";
import { sellerInventoryApi } from "@/lib/api/sellerInventory";
import { toLatinDigits } from "@/lib/utils/digits";
import { formatNumber } from "@/lib/utils/format";
import { firstFieldErrors } from "@/lib/utils/zod";
import { describeInventoryError } from "./inventoryErrors";

export type StockChangeMode = "restock" | "adjust";
type AdjustKind = "newQuantity" | "delta";

interface Props {
  item: InventoryItem;
  mode: StockChangeMode;
  onClose: () => void;
  /** بعد از موفقیت (موجودی در Backend تغییر کرده است) */
  onDone: () => void;
}

/** عدد صحیح (با علامت اختیاری) از ورودی؛ خالی → undefined، نامعتبر → NaN */
function parseSignedInteger(raw: string): number | undefined {
  const cleaned = toLatinDigits(raw).replace(/[\s,،٬]/g, "").replace(/[−–]/g, "-");
  if (cleaned === "") return undefined;
  return /^[+-]?\d+$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}

export function StockChangeDialog({ item, mode, onClose, onDone }: Props) {
  const { toast } = useToast();
  const [kind, setKind] = useState<AdjustKind>("newQuantity");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Ref علاوه بر state: دو کلیک پشت‌سرهم قبل از Render بعدی هم فقط یک درخواست می‌سازد
  const inFlight = useRef(false);

  const isRestock = mode === "restock";
  const amountField = isRestock ? "quantity" : kind;
  const title = isRestock ? "افزایش موجودی" : "اصلاح موجودی";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    setFormError(null);

    const parsedAmount = parseSignedInteger(amount);
    const candidate = isRestock
      ? { quantity: parsedAmount, reason }
      : { [kind]: parsedAmount, reason };
    const parsed = isRestock ? restockSchema.safeParse(candidate) : adjustStockSchema.safeParse(candidate);
    if (!parsed.success) {
      const fieldErrors = firstFieldErrors(parsed.error);
      // خطای «فقط یکی از دو مقدار» وقتی مقدار خالی است باید روی همان ورودی دیده شود
      if (!isRestock && parsedAmount === undefined) fieldErrors[kind] = "مقدار را وارد کنید";
      if (isRestock && parsedAmount === undefined) fieldErrors.quantity = "تعداد الزامی است";
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    inFlight.current = true;
    setPending(true);
    try {
      const result = isRestock
        ? await sellerInventoryApi.restock(item.variantId, restockSchema.parse(candidate))
        : await sellerInventoryApi.adjust(item.variantId, adjustStockSchema.parse(candidate));
      toast({
        title: isRestock ? "موجودی افزایش یافت" : "موجودی اصلاح شد",
        description: `موجودی جدید: ${formatNumber(result.item.stock)}`,
        variant: "success",
      });
      onDone();
      onClose();
    } catch (error) {
      const described = describeInventoryError(error);
      setErrors(described.fieldErrors);
      setFormError(described.message);
      if (described.fatal) onDone(); // فهرست را تازه می‌کنیم تا وضعیت واقعی دیده شود
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  const formId = `stock-form-${mode}`;
  return (
    <Modal
      open
      onClose={() => {
        if (!inFlight.current) onClose();
      }}
      title={title}
      description={`${item.productTitle} — ${item.color} / ${item.size} (${item.sku}) · موجودی فعلی: ${formatNumber(item.stock)}`}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            انصراف
          </Button>
          <Button type="submit" form={formId} loading={pending} disabled={pending}>
            {isRestock ? "افزایش موجودی" : "ثبت اصلاح"}
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
        {!isRestock && (
          <Select
            label="روش اصلاح"
            name="kind"
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as AdjustKind);
              setAmount("");
              setErrors({});
            }}
          >
            <option value="newQuantity">تعیین موجودی نهایی (شمارش انبار)</option>
            <option value="delta">افزودن یا کسر (مثلاً ‎-۲‎ یا ‎+۳‎)</option>
          </Select>
        )}
        <Input
          label={isRestock ? "تعداد افزوده‌شده" : kind === "newQuantity" ? "موجودی نهایی" : "مقدار تغییر"}
          name={amountField}
          inputMode={kind === "delta" && !isRestock ? "text" : "numeric"}
          autoComplete="off"
          dir="ltr"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          error={errors[amountField] ?? ""}
          hint={
            !isRestock && kind === "delta"
              ? "با موجودی لحظهٔ ثبت محاسبه می‌شود؛ موجودی هرگز منفی نمی‌شود."
              : ""
          }
        />
        <Textarea
          label="دلیل"
          name="reason"
          rows={3}
          required
          maxLength={300}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          error={errors.reason ?? ""}
          hint="برای سابقهٔ انبار ثبت می‌شود (حداقل ۳ کاراکتر)."
        />
      </form>
    </Modal>
  );
}
