import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/guards";
import { OrdersListView } from "@/features/orders/OrdersListView";

export const metadata: Metadata = { title: "سفارش‌های من" };

export default function OrdersPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="type-h1 mb-8">سفارش‌های من</h1>
      <RequireAuth>
        <OrdersListView />
      </RequireAuth>
    </main>
  );
}
