import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { GuestOnly } from "@/features/auth/guards";
import { RegisterForm } from "@/features/auth/components/RegisterForm";
import { safeRedirectPath } from "@/lib/utils/redirect";

export const metadata: Metadata = { title: "ثبت‌نام" };

export default function RegisterPage({
  searchParams,
}: {
  searchParams: { next?: string | string[] };
}) {
  const nextPath = safeRedirectPath(searchParams.next);

  return (
    <GuestOnly redirectTo={nextPath}>
      <Card padding="lg" className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="type-h2">ساخت حساب کاربری</h1>
          <p className="text-ink-muted">چند ثانیه تا شروع خرید فاصله دارید.</p>
        </div>
        <RegisterForm nextPath={nextPath} />
      </Card>
    </GuestOnly>
  );
}
