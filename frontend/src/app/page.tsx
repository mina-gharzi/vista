import Link from "next/link";
import { buttonClasses } from "@/components/ui";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="type-h1">ویستا</h1>
      <p className="text-ink-muted">
        اسکلت اولیه پروژه آماده است. این صفحه با شروع پیاده‌سازی Feature «فهرست محصولات» جایگزین
        می‌شود.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/login" className={buttonClasses()}>
          ورود
        </Link>
        <Link href="/register" className={buttonClasses({ variant: "secondary" })}>
          ثبت‌نام
        </Link>
        <Link href="/account" className={buttonClasses({ variant: "ghost" })}>
          حساب کاربری
        </Link>
      </div>
    </main>
  );
}
