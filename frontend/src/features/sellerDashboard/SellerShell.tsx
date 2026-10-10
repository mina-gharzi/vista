"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { SELLER_NAV, type SellerNavItem } from "./sellerNav";

const itemBase = "flex items-center justify-between gap-2 rounded px-3 py-2.5 text-sm font-medium";

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col gap-1">
      {SELLER_NAV.map((item) => (
        <li key={item.key}>
          <NavEntry item={item} active={pathname.startsWith(item.href)} onNavigate={onNavigate} />
        </li>
      ))}
    </ul>
  );
}

function NavEntry({
  item,
  active,
  onNavigate,
}: {
  item: SellerNavItem;
  active: boolean;
  onNavigate: (() => void) | undefined;
}) {
  if (!item.available) {
    // بخش ساخته‌نشده: لینک نیست، فقط توضیح می‌دهد که به‌زودی می‌آید
    return (
      <span aria-disabled="true" className={cn(itemBase, "cursor-not-allowed text-ink-faint")}>
        {item.label}
        <Badge variant="neutral">به‌زودی</Badge>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      {...(onNavigate ? { onClick: onNavigate } : {})}
      className={cn(
        itemBase,
        active ? "bg-bordeaux-tint text-bordeaux" : "text-ink hover:bg-ivory",
      )}
    >
      {item.label}
    </Link>
  );
}

/**
 * قالب ناحیه فروشنده: دسکتاپ = سایدبار ثابت، موبایل/تبلت = نوار بالا با منوی بازشونده
 * (دکمه با aria-expanded، بستن با Esc یا انتخاب لینک). کنترل دسترسی اینجا نیست؛ مرجع آن Backend است.
 */
export function SellerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  // با تغییر مسیر منوی موبایل بسته می‌شود
  useEffect(() => setMenuOpen(false), [pathname]);

  // بستن با Esc: Listener روی document (نه روی عنصر غیرتعاملی) و فقط وقتی منو باز است
  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-ivory lg:flex">
      <aside
        aria-label="منوی فروشنده"
        className="hidden w-64 shrink-0 flex-col gap-6 border-e border-border bg-ivory-soft p-5 lg:flex"
      >
        <Link href="/" className="text-2xl font-semibold tracking-tight text-bordeaux">
          ویستا
        </Link>
        <nav aria-label="ناوبری فروشنده">
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
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d={menuOpen ? "m6 6 12 12M18 6 6 18" : "M4 7h16M4 12h16M4 17h16"}
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
              {menuOpen ? "بستن منو" : "منوی فروشنده"}
            </button>
          </div>
          {menuOpen && (
            <nav id={menuId} aria-label="ناوبری فروشنده (موبایل)" className="mt-3">
              <NavList pathname={pathname} onNavigate={() => setMenuOpen(false)} />
            </nav>
          )}
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
