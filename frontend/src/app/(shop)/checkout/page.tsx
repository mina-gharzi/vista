import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/guards";
import { CheckoutView } from "@/features/checkout/CheckoutView";

export const metadata: Metadata = { title: "تسویه‌حساب" };

export default function CheckoutPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="type-h1 mb-8">تسویه‌حساب</h1>
      <RequireAuth>
        <CheckoutView />
      </RequireAuth>
    </main>
  );
}
