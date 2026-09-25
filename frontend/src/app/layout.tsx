import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import { ToastProvider } from "@/components/ui";
import { AuthProvider } from "@/features/auth/AuthProvider";
import "./globals.css";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ویستا | بازار آنلاین مد",
    template: "%s | ویستا",
  },
  description: "بازار آنلاین چندفروشنده مد و پوشاک",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
