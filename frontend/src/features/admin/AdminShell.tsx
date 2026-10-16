"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { ADMIN_NAV } from "./adminNav";

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col gap-1">
      {ADMIN_NAV.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <li key={item.key}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              {...(onNavigate ? { onClick: onNavigate } : {})}
              className={cn(
                "flex items-center rounded px-3 py-2.5 text-sm font-medium",
                active ? "bg-bordeaux-tint text-bordeaux" : "text-ink hover:bg-ivory",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** قالب ناحیه ادمین (همان الگوی SellerShell): سایدبار دسکتاپ و منوی بازشونده موبایل. */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-ivory lg:flex">
      <aside
        aria-label="منوی مدیریت"
        className="hidden w-64 shrink-0 flex-col gap-6 border-e border-border bg-ivory-soft p-5 lg:flex"
      >
        <Link href="/" className="text-2xl font-semibold tracking-tight text-bordeaux">
          ویستا <span className="text-sm font-normal text-ink-muted">مدیریت</span>
        </Link>
        <nav aria-label="ناوبری مدیریت">
          <NavList pathname={pathname} />
        </nav>
        <Link href="/" className="mt-auto text-sm text-ink-muted hover:text-bordeaux">
          بازگشت به فروشگاه
        </Link>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="border-b border-border bg-ivory-soft px-4 py-3 lg:hidden">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-semibold tracking-tight text-bordeaux">
              ویستا
            </Link>
            <button
              ref={buttonRef}
              type="button"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((open) => !open)}
              className="type-button inline-flex h-11 items-center gap-2 rounded border border-ink px-4 hover:bg-ink hover:text-ivory"
            >
              {menuOpen ? "بستن منو" : "منوی مدیریت"}
            </button>
          </div>
          {menuOpen && (
            <nav id={menuId} aria-label="ناوبری مدیریت (موبایل)" className="mt-3">
              <NavList pathname={pathname} onNavigate={() => setMenuOpen(false)} />
            </nav>
          )}
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
