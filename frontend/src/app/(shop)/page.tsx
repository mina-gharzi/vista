import Link from "next/link";
import { buttonClasses } from "@/components/ui";

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="type-h1">ویستا</h1>
      <p className="text-ink-muted">بازار آنلاین مد و پوشاک. اسکلت اولیه پروژه آماده است.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/categories" className={buttonClasses()}>
          مشاهده دسته‌بندی‌ها
        </Link>
        <Link href="/login" className={buttonClasses({ variant: "secondary" })}>
          ورود
        </Link>
        <Link href="/register" className={buttonClasses({ variant: "ghost" })}>
          ثبت‌نام
        </Link>
      </div>
    </main>
  );
}
