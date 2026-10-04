import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/guards";
import { SellerApplyView } from "@/features/seller/SellerApplyView";

export const metadata: Metadata = { title: "شروع فروش در ویستا" };

export default function SellerApplyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-8 flex flex-col gap-2">
        <h1 className="type-h1">شروع فروش در VISTA</h1>
        <p className="text-ink-muted">
          فروشگاه خود را در بازار آنلاین مد ویستا معرفی کنید. پس از ثبت درخواست، تیم ما اطلاعات را
          بررسی می‌کند و وضعیت درخواست را همین‌جا به شما نشان می‌دهیم.
        </p>
      </header>
      <RequireAuth>
        <SellerApplyView />
      </RequireAuth>
    </main>
  );
}
