"use client";

import type { CatalogFilterOptions, CategoryNode } from "@vista/shared";
import { useState } from "react";
import { Button, Checkbox, Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { toLatinDigits } from "@/lib/utils/digits";
import type { DiscoveryFilters } from "@/lib/utils/discoveryState";

export function flattenCategories(nodes: CategoryNode[], depth = 0): { slug: string; label: string }[] {
  return nodes.flatMap((node) => [
    { slug: node.slug, label: `${"— ".repeat(depth)}${node.name}` },
    ...flattenCategories(node.children, depth + 1),
  ]);
}

function OptionChip({ label, selected, onClick, group }: { label: string; selected: boolean; onClick: () => void; group: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${group} ${label}`}
      onClick={onClick}
      className={cn(
        "min-h-10 rounded border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
        selected ? "border-bordeaux bg-bordeaux text-ivory" : "border-border text-ink hover:border-ink",
      )}
    >
      {label}
    </button>
  );
}

interface Props {
  value: DiscoveryFilters;
  /** تغییر فیلترها (Page همیشه توسط Caller به ۱ برمی‌گردد) */
  onChange: (patch: Partial<DiscoveryFilters>) => void;
  categories: { slug: string; label: string }[];
  options: CatalogFilterOptions | null;
  /** immediate=true: هر انتخاب فوراً اعمال می‌شود (سایدبار)؛ false: فقط پیش‌نویس (منوی موبایل) */
  immediate: boolean;
  idPrefix: string;
}

/** پنل فیلتر مشترک بین سایدبار دسکتاپ و منوی موبایل. */
export function FilterPanel({ value, onChange, categories, options, immediate, idPrefix }: Props) {
  const [min, setMin] = useState(value.minPrice === null ? "" : String(value.minPrice));
  const [max, setMax] = useState(value.maxPrice === null ? "" : String(value.maxPrice));
  const [priceError, setPriceError] = useState("");

  const parse = (raw: string): number | null | "invalid" => {
    const latin = toLatinDigits(raw).trim();
    if (latin === "") return null;
    return /^\d{1,10}$/.test(latin) ? Number(latin) : "invalid";
  };

  const commitPrice = (rawMin: string, rawMax: string, show: boolean) => {
    const a = parse(rawMin);
    const b = parse(rawMax);
    if (a === "invalid" || b === "invalid") {
      if (show) setPriceError("قیمت را فقط به‌صورت عدد وارد کنید");
      return;
    }
    if (a !== null && b !== null && a > b) {
      if (show) setPriceError("حداقل قیمت نباید از حداکثر بیشتر باشد");
      return;
    }
    setPriceError("");
    onChange({ minPrice: a === 0 ? null : a, maxPrice: b });
  };

  const field = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="flex flex-col gap-6">
      <Select
        id={field("category")}
        label="دسته‌بندی"
        value={value.category}
        onChange={(event) => onChange({ category: event.target.value })}
      >
        <option value="">همه دسته‌ها</option>
        {categories.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.label}
          </option>
        ))}
      </Select>

      <fieldset className="flex flex-col gap-3">
        <legend className="type-label mb-1">بازهٔ قیمت (تومان)</legend>
        <div className="grid grid-cols-2 gap-3">
          <Input
            id={field("min")}
            label="از"
            inputMode="numeric"
            autoComplete="off"
            value={min}
            placeholder={options?.priceRange ? String(options.priceRange.min) : ""}
            onChange={(event) => {
              setMin(event.target.value);
              if (!immediate) commitPrice(event.target.value, max, false);
            }}
          />
          <Input
            id={field("max")}
            label="تا"
            inputMode="numeric"
            autoComplete="off"
            value={max}
            placeholder={options?.priceRange ? String(options.priceRange.max) : ""}
            onChange={(event) => {
              setMax(event.target.value);
              if (!immediate) commitPrice(min, event.target.value, false);
            }}
          />
        </div>
        {priceError && (
          <p role="alert" className="text-sm text-danger">
            {priceError}
          </p>
        )}
        {immediate && (
          <Button type="button" variant="secondary" size="sm" onClick={() => commitPrice(min, max, true)}>
            اعمال قیمت
          </Button>
        )}
      </fieldset>

      {options && options.colors.length > 0 && (
        <div role="group" aria-label="رنگ" className="flex flex-col gap-2">
          <span className="type-label">رنگ</span>
          <div className="flex flex-wrap gap-2">
            {options.colors.map((c) => (
              <OptionChip key={c} group="رنگ" label={c} selected={value.color.toLowerCase() === c.toLowerCase()} onClick={() => onChange({ color: value.color.toLowerCase() === c.toLowerCase() ? "" : c })} />
            ))}
          </div>
        </div>
      )}

      {options && options.sizes.length > 0 && (
        <div role="group" aria-label="سایز" className="flex flex-col gap-2">
          <span className="type-label">سایز</span>
          <div className="flex flex-wrap gap-2">
            {options.sizes.map((s) => (
              <OptionChip key={s} group="سایز" label={s} selected={value.size.toLowerCase() === s.toLowerCase()} onClick={() => onChange({ size: value.size.toLowerCase() === s.toLowerCase() ? "" : s })} />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Checkbox
          id={field("instock")}
          label="فقط کالاهای موجود"
          checked={value.inStock}
          onChange={(event) => onChange({ inStock: event.target.checked })}
        />
        <Checkbox
          id={field("discounted")}
          label="فقط کالاهای تخفیف‌دار"
          checked={value.discounted}
          onChange={(event) => onChange({ discounted: event.target.checked })}
        />
      </div>
    </div>
  );
}
