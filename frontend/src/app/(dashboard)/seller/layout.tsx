import type { ReactNode } from "react";
import { RequireAuth } from "@/features/auth/guards";
import { SellerShell } from "@/features/sellerDashboard/SellerShell";

/**
 * ناحیه فروشنده: ورود الزامی (UX). دسترسی واقعی به داده را Backend فقط به فروشنده APPROVED می‌دهد.
 * فقط مسیرهای زیر (dashboard)/seller از این قالب استفاده می‌کنند؛ /seller/apply و /seller/application
 * در (shop) می‌مانند و همان Header فروشگاه را دارند.
 */
export default function SellerAreaLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <SellerShell>{children}</SellerShell>
    </RequireAuth>
  );
}
