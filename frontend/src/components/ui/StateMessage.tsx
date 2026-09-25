import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "./Button";

interface StateMessageProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  role?: "status" | "alert";
  className?: string;
}

function StateMessage({ title, description, icon, action, role, className }: StateMessageProps) {
  return (
    <div
      role={role}
      className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}
    >
      {icon && <div className="text-ink-faint">{icon}</div>}
      <h2 className="type-h3">{title}</h2>
      {description && <p className="max-w-md text-ink-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

const BagIcon = (
  <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M5 8h14l-1 12H6L5 8Zm4 0V7a3 3 0 0 1 6 0v1"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);

const AlertIcon = (
  <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" />
    <path
      d="M12 7.5v5.5M12 16.5v.01"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

type EmptyStateProps = Omit<StateMessageProps, "role" | "icon"> & { icon?: ReactNode };

export function EmptyState({ icon = BagIcon, ...props }: EmptyStateProps) {
  return <StateMessage role="status" icon={icon} {...props} />;
}

interface ErrorStateProps extends Omit<StateMessageProps, "role" | "icon" | "title"> {
  title?: string;
  /** اگر داده شود، دکمه «تلاش مجدد» نمایش داده می‌شود */
  onRetry?: () => void;
}

export function ErrorState({
  title = "مشکلی پیش آمد",
  description = "دریافت اطلاعات با خطا مواجه شد. لطفاً دوباره تلاش کنید.",
  onRetry,
  action,
  ...props
}: ErrorStateProps) {
  return (
    <StateMessage
      role="alert"
      icon={AlertIcon}
      title={title}
      description={description}
      action={
        action ??
        (onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            تلاش مجدد
          </Button>
        ) : undefined)
      }
      {...props}
    />
  );
}
