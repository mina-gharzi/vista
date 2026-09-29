import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/guards";
import { AccountView } from "@/features/account/AccountView";

export const metadata: Metadata = { title: "حساب کاربری" };

export default function AccountPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <RequireAuth>
        <AccountView />
      </RequireAuth>
    </main>
  );
}
