import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/guards";
import { SellerApplicationStatusView } from "@/features/seller/SellerApplicationStatusView";

export const metadata: Metadata = { title: "وضعیت درخواست فروشندگی" };

export default function SellerApplicationPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="type-h1 mb-8">وضعیت درخواست فروشندگی</h1>
      <RequireAuth>
        <SellerApplicationStatusView />
      </RequireAuth>
    </main>
  );
}
