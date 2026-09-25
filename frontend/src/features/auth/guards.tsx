"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Spinner } from "@/components/ui";
import { useAuth } from "./AuthProvider";

function FullPageSpinner() {
  return (
    <div aria-busy="true" className="flex min-h-[60vh] items-center justify-center text-bordeaux">
      <Spinner size="lg" label="در حال بررسی نشست" />
    </div>
  );
}

/** فقط برای کاربر واردشده. توجه: مرجع اصلی Authorization همیشه Backend است؛ این فقط UX است. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status !== "authenticated") return <FullPageSpinner />;
  return <>{children}</>;
}

/** فقط برای مهمان (صفحات ورود/ثبت‌نام). کاربر واردشده به `redirectTo` هدایت می‌شود. */
export function GuestOnly({ children, redirectTo }: { children: ReactNode; redirectTo: string }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace(redirectTo);
  }, [status, router, redirectTo]);

  if (status !== "unauthenticated") return <FullPageSpinner />;
  return <>{children}</>;
}
