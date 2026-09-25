"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  /** Controlled */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Uncontrolled */
  defaultValue?: string;
  /** برای Screen Reader */
  label: string;
}

/** Tabs طبق الگوی WAI-ARIA (Roving tabindex). جهت فلش‌ها با RTL/LTR هماهنگ می‌شود. */
export function Tabs({ tabs, value, onValueChange, defaultValue, label }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue ?? tabs[0]?.value ?? "");
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const active = value ?? internal;
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.value === active),
  );
  const activeTab = tabs[activeIndex];

  const activate = (index: number) => {
    const tab = tabs[index];
    if (!tab) return;
    if (value === undefined) setInternal(tab.value);
    onValueChange?.(tab.value);
    tabRefs.current[index]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const isRtl = listRef.current ? getComputedStyle(listRef.current).direction === "rtl" : false;
    const nextKey = isRtl ? "ArrowLeft" : "ArrowRight";
    const prevKey = isRtl ? "ArrowRight" : "ArrowLeft";
    const count = tabs.length;

    if (event.key === nextKey) activate((activeIndex + 1) % count);
    else if (event.key === prevKey) activate((activeIndex - 1 + count) % count);
    else if (event.key === "Home") activate(0);
    else if (event.key === "End") activate(count - 1);
    else return;

    event.preventDefault();
  };

  return (
    <div>
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        className="flex gap-6 overflow-x-auto border-b border-border"
      >
        {tabs.map((tab, index) => {
          const selected = index === activeIndex;
          return (
            <button
              key={tab.value}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.value}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.value}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => activate(index)}
              onKeyDown={handleKeyDown}
              className={cn(
                "type-button -mb-px shrink-0 border-b-2 py-3 transition-colors",
                selected
                  ? "border-bordeaux text-bordeaux"
                  : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab && (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${activeTab.value}`}
          aria-labelledby={`${baseId}-tab-${activeTab.value}`}
          tabIndex={0}
          className="pt-5"
        >
          {activeTab.content}
        </div>
      )}
    </div>
  );
}
