// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SellerDashboard } from "@vista/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "@/lib/api/client";
import { sellerDashboardApi } from "@/lib/api/sellerDashboard";
import { formatNumber, formatPrice } from "@/lib/utils/format";
import { SellerDashboardView } from "@/features/sellerDashboard/SellerDashboardView";
import { SellerShell } from "@/features/sellerDashboard/SellerShell";

// config/env.ts در زمان Import خطا می‌دهد اگر این متغیر نباشد؛ hoisted یعنی قبل از Importها اجرا می‌شود
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL ??= "http://localhost:4000/api";
});

// Testing Library بدون globals به‌صورت خودکار پاک‌سازی نمی‌کند
afterEach(cleanup);

vi.mock("next/navigation", () => ({
  usePathname: () => "/seller/dashboard",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/lib/api/sellerDashboard", () => ({
  sellerDashboardApi: { get: vi.fn() },
}));

const get = vi.mocked(sellerDashboardApi.get);

function makeDashboard(overrides: Partial<SellerDashboard> = {}): SellerDashboard {
  return {
    seller: { id: "s1", storeName: "فروشگاه رویا", slug: "roya-fashion", status: "APPROVED" },
    summary: {
      totalSales: 125_000_000,
      totalOrders: 34,
      pendingOrders: 6,
      completedOrders: 20,
      ordersByStatus: { PENDING: 4, PROCESSING: 2, SHIPPED: 8, DELIVERED: 20, CANCELLED: 1 },
      productCount: 21,
      publishedProductCount: 18,
      lowStockCount: 5,
      outOfStockCount: 3,
    },
    recentOrders: [
      {
        id: "o1",
        orderNumber: 1042,
        createdAt: "2026-10-01T10:00:00.000Z",
        status: "SHIPPED",
        total: 2_500_000,
        itemCount: 3,
      },
      {
        id: "o2",
        orderNumber: 1041,
        createdAt: "2026-09-30T10:00:00.000Z",
        status: "DELIVERED",
        total: 900_000,
        itemCount: 1,
      },
    ],
    inventoryAlerts: {
      lowStockThreshold: 5,
      lowStock: [
        { variantId: "v1", productId: "p1", productTitle: "کت زنانه", size: "M", color: "مشکی", stock: 2 },
      ],
      outOfStock: [
        { variantId: "v2", productId: "p2", productTitle: "شلوار کتان", size: "L", color: "سورمه‌ای", stock: 0 },
      ],
    },
    ...overrides,
  };
}

beforeEach(() => {
  get.mockReset();
});

describe("SellerDashboardView", () => {
  it("1) شاخص‌ها را از داده Backend با ارقام فارسی نمایش می‌دهد", async () => {
    get.mockResolvedValue(makeDashboard());
    render(<SellerDashboardView />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "خوش آمدید، فروشگاه رویا" }),
    ).toBeInTheDocument();
    const summary = screen.getByLabelText("خلاصه وضعیت فروشگاه");
    expect(within(summary).getByText(formatPrice(125_000_000))).toBeInTheDocument();
    expect(within(summary).getByText(formatNumber(34))).toBeInTheDocument();
    expect(within(summary).getByText(formatNumber(21))).toBeInTheDocument();
    expect(within(summary).getByText(formatNumber(5))).toBeInTheDocument();
    expect(within(summary).getByText("۶ سفارش در انتظار ارسال")).toBeInTheDocument();
    // شمارش‌ها به تفکیک وضعیت‌های واقعی سیستم
    expect(within(summary).getByText("در انتظار آماده‌سازی")).toBeInTheDocument();
    expect(within(summary).getByText("تحویل‌شده")).toBeInTheDocument();
    // بدون هیچ آرگومانی (sellerId) فراخوانی می‌شود
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith();
  });

  it("2) حالت Loading: اسکلت با aria-busy", () => {
    get.mockReturnValue(new Promise(() => {}));
    render(<SellerDashboardView />);
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("3) خطا: پیام، دکمه تلاش مجدد و بارگذاری دوباره", async () => {
    get.mockRejectedValueOnce(new ApiRequestError(500, "INTERNAL_SERVER_ERROR", "stack trace xyz"));
    get.mockResolvedValueOnce(makeDashboard());
    const user = userEvent.setup();
    render(<SellerDashboardView />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/stack trace/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "تلاش مجدد" }));
    expect(await screen.findByText("خوش آمدید، فروشگاه رویا")).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("4) بدون سفارش: پیام خالی مناسب (نه داشبورد خالی)", async () => {
    get.mockResolvedValue(makeDashboard({ recentOrders: [] }));
    render(<SellerDashboardView />);

    expect(await screen.findByText("هنوز سفارشی ثبت نشده است.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("5) سفارش‌های اخیر: شماره، تعداد، مبلغ و وضعیت (جدول + کارت موبایل)", async () => {
    get.mockResolvedValue(makeDashboard());
    render(<SellerDashboardView />);

    const table = await screen.findByRole("table");
    for (const header of ["شماره سفارش", "تاریخ", "تعداد کالا", "مبلغ", "وضعیت"]) {
      expect(within(table).getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    const row = within(table).getByRole("row", { name: new RegExp(formatNumber(1042)) });
    expect(within(row).getByText(formatPrice(2_500_000))).toBeInTheDocument();
    expect(within(row).getByText("ارسال‌شده")).toBeInTheDocument();
    // نسخه کارتی موبایل هم همان داده را دارد
    expect(screen.getAllByText(formatPrice(900_000))).toHaveLength(2);
  });

  it("6) هشدار موجودی: رو به اتمام و ناموجود با تعداد باقی‌مانده", async () => {
    get.mockResolvedValue(makeDashboard());
    render(<SellerDashboardView />);

    const alerts = (await screen.findByRole("heading", { name: "هشدار موجودی" })).closest("section")!;
    expect(within(alerts).getByText("کت زنانه")).toBeInTheDocument();
    expect(within(alerts).getByText("مشکی / M")).toBeInTheDocument();
    expect(within(alerts).getByText("۲ عدد باقی مانده")).toBeInTheDocument();
    expect(within(alerts).getByText("شلوار کتان")).toBeInTheDocument();
    expect(within(alerts).getByText("ناموجود")).toBeInTheDocument();
    // بخش موجودی هنوز ساخته نشده: دکمه غیرفعال است، لینک به صفحه ناموجود نیست
    expect(within(alerts).queryByRole("link", { name: /مشاهده موجودی/, hidden: false })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("بدون هشدار: پیام «موردی وجود ندارد»", async () => {
    const base = makeDashboard();
    get.mockResolvedValue(
      makeDashboard({
        summary: { ...base.summary, lowStockCount: 0, outOfStockCount: 0 },
        inventoryAlerts: { lowStockThreshold: 5, lowStock: [], outOfStock: [] },
      }),
    );
    render(<SellerDashboardView />);
    expect(await screen.findAllByText("موردی وجود ندارد.")).toHaveLength(2);
  });

  it("اقدام‌های سریع برای بخش‌های ساخته‌نشده غیرفعال‌اند (عملکرد ساختگی ندارند)", async () => {
    get.mockResolvedValue(makeDashboard());
    render(<SellerDashboardView />);

    const quick = (await screen.findByRole("heading", { name: "اقدام سریع" })).closest("section")!;
    for (const name of [/افزودن محصول/, /مشاهده سفارش‌ها/, /مدیریت موجودی/]) {
      expect(within(quick).getByRole("link", { name })).toHaveAttribute("aria-disabled", "true");
    }
    expect(within(quick).queryByRole("link", { name: /افزودن محصول/ })).not.toHaveAttribute("href");
  });

  it("8) فروشنده تأییدشده: اطلاعات فروشگاه و وضعیت فعال دیده می‌شود", async () => {
    get.mockResolvedValue(makeDashboard());
    render(<SellerDashboardView />);

    const info = (await screen.findByRole("heading", { name: "اطلاعات فروشگاه" })).closest("section")!;
    expect(within(info).getByText("roya-fashion")).toBeInTheDocument();
    expect(within(info).getByText("فعال / تأیید شده")).toBeInTheDocument();
  });

  it("8b) کاربر غیرمجاز (403): پیام Backend و لینک وضعیت درخواست، بدون داشبورد", async () => {
    get.mockRejectedValue(
      new ApiRequestError(403, "AUTHORIZATION_ERROR", "درخواست فروشندگی شما هنوز در انتظار بررسی است"),
    );
    render(<SellerDashboardView />);

    expect(await screen.findByText("به پنل فروشنده دسترسی ندارید")).toBeInTheDocument();
    expect(screen.getByText("درخواست فروشندگی شما هنوز در انتظار بررسی است")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "وضعیت درخواست فروشندگی" })).toHaveAttribute(
      "href",
      "/seller/application",
    );
    expect(screen.queryByText("فروش کل")).not.toBeInTheDocument();
  });
});

describe("SellerShell — ناوبری", () => {
  it("7) منوی موبایل: بسته در ابتدا، باز با دکمه (aria-expanded)، بسته با Esc", async () => {
    const user = userEvent.setup();
    render(
      <SellerShell>
        <p>محتوا</p>
      </SellerShell>,
    );

    const toggle = screen.getByRole("button", { name: "منوی فروشنده" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("navigation", { name: "ناوبری فروشنده (موبایل)" })).not.toBeInTheDocument();

    await user.click(toggle);
    expect(screen.getByRole("button", { name: "بستن منو" })).toHaveAttribute("aria-expanded", "true");
    const mobileNav = screen.getByRole("navigation", { name: "ناوبری فروشنده (موبایل)" });
    expect(within(mobileNav).getByRole("link", { name: "داشبورد" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("navigation", { name: "ناوبری فروشنده (موبایل)" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "منوی فروشنده" })).toHaveFocus();
  });

  it("بخش‌های آینده «به‌زودی» و غیرفعال‌اند و لینک نیستند", () => {
    render(
      <SellerShell>
        <p>محتوا</p>
      </SellerShell>,
    );
    const desktopNav = screen.getByRole("navigation", { name: "ناوبری فروشنده" });
    for (const label of ["محصولات", "سفارش‌ها", "موجودی", "تنظیمات"]) {
      const item = within(desktopNav).getByText(label).closest("[aria-disabled]");
      expect(item).toHaveAttribute("aria-disabled", "true");
      expect(item?.tagName).not.toBe("A");
    }
    expect(within(desktopNav).getAllByText("به‌زودی")).toHaveLength(4);
  });

  it("انتخاب لینک فعال در منوی موبایل، منو را می‌بندد", async () => {
    const user = userEvent.setup();
    render(
      <SellerShell>
        <p>محتوا</p>
      </SellerShell>,
    );
    await user.click(screen.getByRole("button", { name: "منوی فروشنده" }));
    const mobileNav = screen.getByRole("navigation", { name: "ناوبری فروشنده (موبایل)" });
    await user.click(within(mobileNav).getByRole("link", { name: "داشبورد" }));
    expect(screen.queryByRole("navigation", { name: "ناوبری فروشنده (موبایل)" })).not.toBeInTheDocument();
  });
});