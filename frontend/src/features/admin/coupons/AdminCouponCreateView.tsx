"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CreateCouponInput } from "@vista/shared";
import { useToast } from "@/components/ui";
import { adminApi } from "@/lib/api/admin";
import { CouponForm } from "./CouponForm";
import { EMPTY_COUPON_FORM, toCreatePayload } from "./couponFormModel";

export function AdminCouponCreateView() {
  const router = useRouter();
  const { toast } = useToast();

  const create = async (payload: CreateCouponInput) => {
    const created = await adminApi.createCoupon(payload);
    toast({ title: "کوپن ساخته شد", variant: "success" });
    router.push(`/admin/coupons/${created.id}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link href="/admin/coupons" className="text-sm text-bordeaux underline">
          بازگشت به کوپن‌ها
        </Link>
        <h1 className="type-h1">کوپن جدید</h1>
      </header>
      <CouponForm mode="create" initial={EMPTY_COUPON_FORM} toPayload={toCreatePayload} onSubmit={create} submitLabel="ساخت کوپن" />
    </div>
  );
}
