import type { Config } from "tailwindcss";

/**
 * Design Tokens مرکزی VISTA (طبق بخش‌های ۷ و ۸ پرامپت مادر).
 * هیچ رنگی نباید به‌صورت Hard-code (مثل bg-[#123456]) در Componentها نوشته شود.
 *
 * نسبت استفاده:  Ivory → غالب | Ink → متن و ساختار | Bordeaux → عناصر مهم/Interactive | Champagne → جزئیات Premium
 *
 * ⚠️ Accessibility: Champagne روی Ivory کنتراست ~۲.۱:۱ دارد، پس فقط برای عناصر تزئینی
 * (ستاره، خط، آیکن کوچک، Badge با متن تیره) استفاده شود؛ برای «متن» از champagne-dark استفاده کن.
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ivory: {
          DEFAULT: "#F7F4EF", // Background اصلی
          soft: "#EFEAE1", // سطح ثانویه (Card، Input، Skeleton)
        },
        ink: {
          DEFAULT: "#1C1C1C", // Soft Black — متن اصلی
          muted: "#5C5954", // متن ثانویه (کنتراست ۶.۴:۱)
          faint: "#6F6A63", // Placeholder/Caption (کنتراست ≥ ۴.۵:۱)
        },
        bordeaux: {
          DEFAULT: "#641C2D", // Primary — دقیقاً طبق پرامپت
          hover: "#4F1623", // Hover/Active دکمه‌ها
          tint: "#F1E6E8", // پس‌زمینه بسیار ملایم برای Selected State
        },
        champagne: {
          DEFAULT: "#C9A46C", // Accent — محدود و کنترل‌شده
          dark: "#8A6A34", // نسخه قابل‌خواندن برای متن (کنتراست ۴.۶:۱)
        },
        // رنگ‌های Semantic — کنترل‌شده و جدا از هویت برند
        success: { DEFAULT: "#2F6B45", tint: "#E6F0EA" },
        danger: { DEFAULT: "#A52F24", tint: "#F7E7E5" },
        warning: { DEFAULT: "#8A5A00", tint: "#F8EFDD" },
        border: {
          DEFAULT: "#E4DDD2",
          strong: "#CFC6B8",
        },
      },
      fontFamily: {
        sans: ["var(--font-vazirmatn)", "Tahoma", "sans-serif"],
      },
      fontSize: {
        // مقیاس تایپوگرافی ثابت — Hierarchy: H1..H3, Body, Caption, Label, Price, Button
        xs: ["0.75rem", { lineHeight: "1.5" }],
        sm: ["0.875rem", { lineHeight: "1.6" }],
        base: ["1rem", { lineHeight: "1.7" }],
        lg: ["1.125rem", { lineHeight: "1.6" }],
        xl: ["1.375rem", { lineHeight: "1.5" }],
        "2xl": ["1.75rem", { lineHeight: "1.4" }],
        "3xl": ["2.25rem", { lineHeight: "1.25" }],
        "4xl": ["3rem", { lineHeight: "1.15" }],
      },
      borderRadius: {
        // گوشه‌ها عمداً کم‌گرد (بخش ۶: Cardهای بیش از حد گرد ممنوع)
        sm: "0.125rem",
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        full: "9999px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(28, 28, 28, 0.05)",
        overlay: "0 8px 24px rgba(28, 28, 28, 0.10)",
      },
      screens: {
        xs: "420px",
        // sm/md/lg/xl/2xl پیش‌فرض Tailwind حفظ می‌شود (Mobile/Tablet/Desktop/Large Desktop)
      },
    },
  },
  plugins: [],
};

export default config;
