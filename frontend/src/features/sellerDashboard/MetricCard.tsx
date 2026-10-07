import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

interface MetricCardProps {
  label: string;
  /** مقدار از قبل قالب‌بندی‌شده (ارقام فارسی) — قالب‌بندی در والد انجام می‌شود */
  value: string;
  caption?: ReactNode;
  /** تأکید ملایم (Champagne) فقط برای مهم‌ترین شاخص */
  highlight?: boolean;
}

export function MetricCard({ label, value, caption, highlight = false }: MetricCardProps) {
  return (
    <Card
      as="div"
      className={cn("flex flex-col gap-1", highlight && "border-t-2 border-t-champagne")}
    >
      <p className="type-caption">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-ink">{value}</p>
      {caption && <p className="text-sm text-ink-muted">{caption}</p>}
    </Card>
  );
}
