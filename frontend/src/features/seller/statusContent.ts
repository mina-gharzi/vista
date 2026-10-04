import type { SellerStatus } from "@vista/shared";
import type { BadgeVariant } from "@/components/ui";

export interface SellerStatusContent {
  title: string;
  statusLabel: string;
  description: string;
  badge: BadgeVariant;
}

/** متن‌های فارسی هر وضعیت درخواست فروشندگی. وضعیت هرگز فقط با رنگ منتقل نمی‌شود (Badge همیشه متن دارد). */
export const SELLER_STATUS_CONTENT: Record<SellerStatus, SellerStatusContent> = {
  PENDING: {
    title: "درخواست فروشندگی شما ثبت شد.",
    statusLabel: "در انتظار بررسی",
    description: "تیم ویستا درخواست شما را بررسی می‌کند. نتیجه همین‌جا به شما نمایش داده می‌شود.",
    badge: "warning",
  },
  APPROVED: {
    title: "فروشگاه شما تأیید شده است.",
    statusLabel: "تأیید شده",
    description: "اکنون می‌توانید وارد پنل فروشنده شوید و محصولات خود را مدیریت کنید.",
    badge: "success",
  },
  REJECTED: {
    title: "درخواست فروشندگی شما تأیید نشده است.",
    statusLabel: "تأیید نشده",
    description: "می‌توانید اطلاعات فروشگاه را اصلاح کنید و دوباره درخواست دهید.",
    badge: "danger",
  },
  SUSPENDED: {
    title: "حساب فروشندگی شما تعلیق شده است.",
    statusLabel: "تعلیق‌شده",
    description:
      "در حال حاضر امکان فعالیت یا ثبت درخواست جدید وجود ندارد. برای اطلاعات بیشتر با پشتیبانی ویستا تماس بگیرید.",
    badge: "danger",
  },
};
