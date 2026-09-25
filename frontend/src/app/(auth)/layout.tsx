import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-6 py-12">
      <Link href="/" className="text-center text-3xl font-semibold tracking-tight text-bordeaux">
        ویستا
      </Link>
      {children}
    </main>
  );
}
