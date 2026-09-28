import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/guards";
import { OrderDetailView } from "@/features/orders/OrderDetailView";

export const metadata: Metadata = { title: "جزئیات سفارش" };

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <RequireAuth>
        <OrderDetailView orderId={params.id} />
      </RequireAuth>
    </main>
  );
}
