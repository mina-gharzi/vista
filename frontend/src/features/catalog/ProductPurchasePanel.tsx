"use client";

import type { PublicProductVariant } from "@vista/shared";
import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Select, useToast } from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { WishlistButton } from "@/features/wishlist/WishlistButton";
import { cartApi } from "@/lib/api/cart";
import { ApiRequestError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/format";
import {
  colorHasStock,
  combinationState,
  displayedPrice,
  resolveVariant,
  sizeHasStock,
  uniqueValues,
} from "./variantSelection";

interface ProductPurchasePanelProps {
  productId: string;
  description: string;
  basePrice: number;
  compareAtPrice: number | null;
  variants: PublicProductVariant[];
}

function Chip({
  label,
  selected,
  dim,
  onSelect,
  group,
}: {
  label: string;
  selected: boolean;
  /** true = در حال حاضر موجود نیست؛ هنوز قابل انتخاب است تا وضعیتش صریح نمایش داده شود */
  dim: boolean;
  onSelect: () => void;
  group: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={dim ? `${group} ${label} (ناموجود)` : `${group} ${label}`}
      onClick={onSelect}
      className={cn(
        "min-h-10 rounded border px-4 py-1.5 text-sm transition-colors",
        selected ? "border-bordeaux bg-bordeaux text-ivory" : "border-border text-ink hover:border-ink",
        dim && !selected && "text-ink-faint line-through",
      )}
    >
      {label}
    </button>
  );
}

/**
 * قیمت + انتخاب رنگ/سایز + افزودن به سبد. ترکیب انتخابی به یک تنوع واقعی (variantId) resolve می‌شود و
 * ترکیبِ ناموجود/نامعتبر هرگز به سبد نمی‌رود (علاوه بر UI، Backend هم تنوع غیرفعال/ناموجود را رد می‌کند).
 */
export function ProductPurchasePanel({
  productId,
  description,
  basePrice,
  compareAtPrice,
  variants,
}: ProductPurchasePanelProps) {
  const { status } = useAuth();
  const { toast } = useToast();

  const colors = uniqueValues(variants.map((v) => v.color));
  const sizes = uniqueValues(variants.map((v) => v.size));

  // اگر فقط یک گزینه وجود دارد، همان از قبل انتخاب است (محصول تک‌رنگ / تک‌سایز)
  const [color, setColor] = useState(colors.length === 1 ? (colors[0] ?? "") : "");
  const [size, setSize] = useState(sizes.length === 1 ? (sizes[0] ?? "") : "");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const selected = resolveVariant(variants, color, size);
  const state = combinationState(variants, color, size);
  const price = displayedPrice(variants, selected, basePrice);
  const maxQuantity = Math.min(selected?.stock ?? 1, 99);

  // تخفیف فقط وقتی معنا دارد که قیمت نمایش‌داده‌شده همان قیمت پایه محصول باشد
  const hasDiscount =
    compareAtPrice !== null && compareAtPrice > price.amount && price.amount === basePrice;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || selected.stock === 0 || submitting) return;
    setSubmitting(true);
    try {
      await cartApi.addItem({ variantId: selected.id, quantity });
      toast({ title: "به سبد خرید اضافه شد", variant: "success" });
    } catch (error) {
      const message = error instanceof ApiRequestError ? error.message : "خطایی رخ داد، دوباره تلاش کنید";
      toast({ title: "افزودن به سبد ناموفق بود", description: message, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const message =
    state === "missing"
      ? "این ترکیب رنگ و سایز وجود ندارد."
      : state === "out_of_stock"
        ? "این ترکیب در حال حاضر ناموجود است."
        : null;

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-3" aria-live="polite">
        {price.isFrom && <span className="text-ink-muted">از</span>}
        <span className="type-price text-2xl" data-testid="price">
          {formatPrice(price.amount)}
        </span>
        {hasDiscount && (
          <>
            <span className="text-ink-faint line-through">{formatPrice(compareAtPrice as number)}</span>
            <Badge variant="premium">
              ٪{Math.round((1 - price.amount / (compareAtPrice as number)) * 100)} تخفیف
            </Badge>
          </>
        )}
      </div>

      <p className="whitespace-pre-line text-ink-muted">{description}</p>

      {variants.length === 0 ? (
        <p role="status" className="text-sm text-danger">
          این کالا در حال حاضر ناموجود است.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {colors.length > 1 && (
            <div role="group" aria-labelledby="color-label" className="flex flex-col gap-2">
              <span id="color-label" className="type-label">
                رنگ{color && `: ${color}`}
              </span>
              <div className="flex flex-wrap gap-2">
                {colors.map((value) => (
                  <Chip
                    key={value}
                    group="رنگ"
                    label={value}
                    selected={value === color}
                    dim={!colorHasStock(variants, value)}
                    onSelect={() => {
                      setColor(value);
                      setQuantity(1);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {sizes.length > 1 && (
            <div role="group" aria-labelledby="size-label" className="flex flex-col gap-2">
              <span id="size-label" className="type-label">
                سایز{size && `: ${size}`}
              </span>
              <div className="flex flex-wrap gap-2">
                {sizes.map((value) => (
                  <Chip
                    key={value}
                    group="سایز"
                    label={value}
                    selected={value === size}
                    dim={!sizeHasStock(variants, value, color)}
                    onSelect={() => {
                      setSize(value);
                      setQuantity(1);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <p role="status" className={cn("min-h-5 text-sm", message ? "text-danger" : "text-ink-muted")}>
            {message ??
              (state === "unselected"
                ? colors.length > 1 && sizes.length > 1
                  ? "رنگ و سایز را انتخاب کنید."
                  : "گزینه مورد نظر را انتخاب کنید."
                : selected && selected.stock <= 5
                  ? `فقط ${selected.stock} عدد باقی مانده است.`
                  : "")}
          </p>
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className="flex-1">
          {status === "loading" ? null : status === "unauthenticated" ? (
            <p className="text-sm text-ink-muted">
              برای افزودن به سبد خرید ابتدا{" "}
              <Link href="/login" className="text-bordeaux underline underline-offset-4">
                وارد شوید
              </Link>
              .
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
              <div className="w-24">
                <Select
                  label="تعداد"
                  value={String(quantity)}
                  disabled={!selected || selected.stock === 0}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                >
                  {Array.from({ length: maxQuantity }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                type="submit"
                loading={submitting}
                disabled={!selected || selected.stock === 0}
              >
                افزودن به سبد خرید
              </Button>
            </form>
          )}
        </div>
        <WishlistButton productId={productId} />
      </div>
    </>
  );
}
