import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type CardPadding = "none" | "sm" | "md" | "lg";

const paddings: Record<CardPadding, string> = { none: "", sm: "p-3", md: "p-5", lg: "p-8" };

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "article" | "section" | "li";
  padding?: CardPadding;
}

export function Card({ as: Tag = "div", padding = "md", className, ...rest }: CardProps) {
  return (
    <Tag
      className={cn("rounded-lg border border-border bg-ivory-soft", paddings[padding], className)}
      {...rest}
    />
  );
}
