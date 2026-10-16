"use client";

import {
  adminSellerStatusSchema,
  PRODUCT_STATUS_LABEL,
  SELLER_STATUS_LABEL,
  SELLER_TARGETS_REQUIRING_REASON,
  type AdminSellerDetail,
  type SellerAdminTarget,
} from "@vista/shared";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, buttonClasses, Card } from "@/components/ui";
import { adminApi } from "@/lib/api/admin";
import { formatDateTime, formatNumber } from "@/lib/utils/format";
import { Field, QueryBoundary } from "./AdminParts";
import { sellerStatusBadge } from "./adminLabels";
import { ReasonDialog } from "./ReasonDialog";
import { useAdminQuery } from "./useAdminQuery";

export const SELLER_ACTION: Record<SellerAdminTarget, { label: string; confirm: string; danger: boolean }> = {
  APPROVED: { label: "تأیید / فعال‌سازی", confirm: "فروشنده اجازهٔ فروش پیدا می‌کند.", danger: false },
  REJECTED: { label: "رد درخواست", confirm: "درخواست رد می‌شود و دلیل آن ثبت می‌گردد.", danger: true },
  SUSPENDED: { label: "تعلیق فروشنده", confirm: "فروشنده دیگر نمی‌تواند بفروشد و محصولاتش از فروشگاه پنهان می‌شود.", danger: true },
};

function Body({ seller, onAction }: { seller: AdminSellerDetail; onAction: (t: SellerAdminTarget) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="type-h1">{seller.storeName}</h1>
          <Badge variant={sellerStatusBadge[seller.status]}>{SELLER_STATUS_LABEL[seller.status]}</Badge>
        </div>
        <Link href="/admin/sellers" className={buttonClasses({ variant: "ghost", size: "sm" })}>
          بازگشت به فروشندگان
        </Link>
      </header>

      {seller.allowedTransitions.length > 0 ? (
        <Card as="section" aria-label="اقدام‌های مدیریتی" className="flex flex-wrap items-center gap-3">
          {seller.allowedTransitions.map((target) => (
            <Button
              key={target}
              variant={SELLER_ACTION[target].danger ? "secondary" : "primary"}
              onClick={() => onAction(target)}
            >
              {SELLER_ACTION[target].label}
            </Button>
          ))}
        </Card>
      ) : (
        <p className="text-sm text-ink-muted">این وضعیت پایانی است و اقدام دیگری ممکن نیست.</p>
      )}

      {seller.statusReason && (
        <Card as="section" aria-label="دلیل آخرین تغییر" className="text-sm">
          <strong>دلیل آخرین تغییر وضعیت: </strong>
          {seller.statusReason}
        </Card>
      )}

      <Card as="section" aria-labelledby="seller-info" className="flex flex-col gap-4">
        <h2 id="seller-info" className="type-h3">
          اطلاعات فروشنده
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="شناسهٔ فروشگاه" value={<span dir="ltr">{seller.storeSlug}</span>} />
          <Field label="تاریخ درخواست" value={formatDateTime(seller.createdAt)} />
          <Field label="مالک" value={seller.owner.name} />
          <Field label="ایمیل" value={<span dir="ltr">{seller.owner.email}</span>} />
          <Field label="تلفن" value={seller.owner.phone ? <span dir="ltr">{seller.owner.phone}</span> : "—"} />
          <Field label="تعداد سفارش‌های فروشنده" value={formatNumber(seller.sellerOrderCount)} />
          {seller.description && <Field label="توضیحات" value={seller.description} />}
        </dl>
      </Card>

      <Card as="section" aria-labelledby="seller-products" className="flex flex-col gap-3">
        <h2 id="seller-products" className="type-h3">
          محصولات
        </h2>
        <ul className="flex flex-wrap gap-4 text-sm">
          {(Object.keys(PRODUCT_STATUS_LABEL) as (keyof typeof PRODUCT_STATUS_LABEL)[]).map((k) => (
            <li key={k}>
              {PRODUCT_STATUS_LABEL[k]}: <span className="tabular-nums">{formatNumber(seller.products[k])}</span>
            </li>
          ))}
        </ul>
        <Link href={`/admin/products?sellerId=${seller.id}`} className="text-sm text-bordeaux hover:underline">
          مشاهدهٔ محصولات این فروشنده
        </Link>
      </Card>

      <Card as="section" aria-labelledby="seller-history" className="flex flex-col gap-3">
        <h2 id="seller-history" className="type-h3">
          سابقهٔ تغییر وضعیت
        </h2>
        {seller.history.length === 0 ? (
          <p className="text-sm text-ink-muted">تغییری ثبت نشده است.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {seller.history.map((h) => (
              <li key={h.id} className="text-sm">
                <span className="font-medium">
                  {SELLER_STATUS_LABEL[h.fromStatus as keyof typeof SELLER_STATUS_LABEL] ?? h.fromStatus} ←{" "}
                  {SELLER_STATUS_LABEL[h.toStatus as keyof typeof SELLER_STATUS_LABEL] ?? h.toStatus}
                </span>
                <span className="text-ink-muted">
                  {" "}
                  · {h.adminName} · {formatDateTime(h.createdAt)}
                </span>
                {h.reason && <p className="text-ink-muted">دلیل: {h.reason}</p>}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

export function AdminSellerDetailView({ sellerId }: { sellerId: string }) {
  const { state, reload, setData } = useAdminQuery(() => adminApi.seller(sellerId), sellerId);
  const [target, setTarget] = useState<SellerAdminTarget | null>(null);

  return (
    <>
      <QueryBoundary state={state} reload={reload} label="جزئیات فروشنده" notFoundTitle="فروشنده یافت نشد">
        {(seller) => (
          <>
            <Body seller={seller} onAction={setTarget} />
            {target && (
              <ReasonDialog
                title={SELLER_ACTION[target].label}
                description={`${seller.storeName} — ${SELLER_ACTION[target].confirm}`}
                confirmLabel="تأیید و ثبت"
                danger={SELLER_ACTION[target].danger}
                reasonRequired={SELLER_TARGETS_REQUIRING_REASON.includes(target)}
                validate={(reason) => {
                  const parsed = adminSellerStatusSchema.safeParse(
                    SELLER_TARGETS_REQUIRING_REASON.includes(target) ? { status: target, reason } : { status: target },
                  );
                  return parsed.success
                    ? { ok: true }
                    : { ok: false, error: parsed.error.issues[0]?.message ?? "دلیل معتبر نیست" };
                }}
                successMessage="وضعیت فروشنده به‌روز شد"
                onSubmit={async (reason) => {
                  const updated = await adminApi.changeSellerStatus(
                    seller.id,
                    SELLER_TARGETS_REQUIRING_REASON.includes(target) ? { status: target, reason } : { status: target },
                  );
                  setData(updated);
                }}
                onClose={() => setTarget(null)}
                onStale={reload}
              />
            )}
          </>
        )}
      </QueryBoundary>
    </>
  );
}
