"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils/cn";

export interface DropdownItem {
  key: string;
  label: string;
  /** یکی از onSelect یا href */
  onSelect?: () => void;
  href?: string;
  tone?: "default" | "danger";
  disabled?: boolean;
}

interface DropdownProps {
  /** متن دکمه فراخوان */
  label: string;
  items: DropdownItem[];
  align?: "start" | "end";
  className?: string;
}

const itemClasses = (tone: DropdownItem["tone"]) =>
  cn(
    "block w-full px-4 py-2.5 text-start text-sm hover:bg-ivory-soft focus:bg-ivory-soft aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    tone === "danger" ? "text-danger" : "text-ink",
  );

/** منوی کشویی طبق الگوی WAI-ARIA Menu Button: ↑ ↓ Home End Esc Tab. */
export function Dropdown({ label, items, align = "start", className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const menuId = useId();

  const enabledIndexes = items.flatMap((item, index) => (item.disabled ? [] : [index]));

  useEffect(() => {
    if (open) itemRefs.current[focusIndex]?.focus();
  }, [open, focusIndex]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const openAt = (position: "first" | "last") => {
    const target =
      position === "first" ? enabledIndexes[0] : enabledIndexes[enabledIndexes.length - 1];
    if (target === undefined) return;
    setFocusIndex(target);
    setOpen(true);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openAt("first");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openAt("last");
    }
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const position = enabledIndexes.indexOf(focusIndex);
    let next: number | undefined;

    switch (event.key) {
      case "ArrowDown":
        next = enabledIndexes[(position + 1) % enabledIndexes.length];
        break;
      case "ArrowUp":
        next = enabledIndexes[(position - 1 + enabledIndexes.length) % enabledIndexes.length];
        break;
      case "Home":
        next = enabledIndexes[0];
        break;
      case "End":
        next = enabledIndexes[enabledIndexes.length - 1];
        break;
      case "Escape":
        event.preventDefault();
        close(true);
        return;
      case "Tab":
        close(false);
        return;
      default:
        return;
    }

    event.preventDefault();
    if (next !== undefined) setFocusIndex(next);
  };

  const select = (item: DropdownItem) => {
    if (item.disabled) return;
    item.onSelect?.();
    close(true);
  };

  return (
    <div ref={rootRef} className={cn("relative inline-block", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close(false) : openAt("first"))}
        onKeyDown={handleTriggerKeyDown}
        className="type-button inline-flex h-11 items-center gap-2 rounded border border-ink-faint px-4 hover:border-ink"
      >
        {label}
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="m5 8 5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <ul
          id={menuId}
          role="menu"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={handleMenuKeyDown}
          className={cn(
            "absolute top-full z-30 mt-1 min-w-48 overflow-hidden rounded border border-border bg-ivory py-1 shadow-overlay",
            align === "end" ? "end-0" : "start-0",
          )}
        >
          {items.map((item, index) => (
            <li key={item.key} role="none">
              {item.href && !item.disabled ? (
                <Link
                  ref={(node) => {
                    itemRefs.current[index] = node;
                  }}
                  href={item.href}
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => close(false)}
                  className={itemClasses(item.tone)}
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  ref={(node) => {
                    itemRefs.current[index] = node;
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  aria-disabled={item.disabled || undefined}
                  onClick={() => select(item)}
                  className={itemClasses(item.tone)}
                >
                  {item.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
