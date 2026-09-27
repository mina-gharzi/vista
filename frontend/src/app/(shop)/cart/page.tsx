import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/guards";
import { CartView } from "@/features/cart/CartView";

export const metadata: Metadata = { title: "سبد خرید" };

export default function CartPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="type-h1 mb-8">سبد خرید</h1>
      <RequireAuth>
        <CartView />
      </RequireAuth>
    </main>
  );
}
