import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/guards";
import { WishlistView } from "@/features/wishlist/WishlistView";

export const metadata: Metadata = { title: "علاقه‌مندی‌ها" };

export default function WishlistPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="type-h1 mb-8">علاقه‌مندی‌ها</h1>
      <RequireAuth>
        <WishlistView />
      </RequireAuth>
    </main>
  );
}
