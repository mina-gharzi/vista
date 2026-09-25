import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { GuestOnly } from "@/features/auth/guards";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { safeRedirectPath } from "@/lib/utils/redirect";

export const metadata: Metadata = { title: "ورود" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string | string[] };
}) {
  const nextPath = safeRedirectPath(searchParams.next);

  return (
    <GuestOnly redirectTo={nextPath}>
      <Card padding="lg" className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="type-h2">ورود به حساب کاربری</h1>
          <p className="text-ink-muted">برای ادامه خرید وارد شوید.</p>
        </div>
        <LoginForm nextPath={nextPath} />
      </Card>
    </GuestOnly>
  );
}
