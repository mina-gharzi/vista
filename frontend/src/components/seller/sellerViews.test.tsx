// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SellerApplicationStatus, SellerStatus } from "@vista/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui";
import { sellerApi } from "@/lib/api/seller";
import { SellerApplicationStatusView } from "@/features/seller/SellerApplicationStatusView";
import { SellerApplyView } from "@/features/seller/SellerApplyView";

// config/env.ts در زمان Import خطا می‌دهد اگر این متغیر نباشد؛ hoisted یعنی قبل از Importها اجرا می‌شود
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL ??= "http://localhost:4000/api";
});

// Testing Library بدون globals به‌صورت خودکار پاک‌سازی نمی‌کند
afterEach(cleanup);

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));
vi.mock("@/lib/api/seller", () => ({
  sellerApi: { apply: vi.fn(), getApplicationStatus: vi.fn() },
}));

const getStatus = vi.mocked(sellerApi.getApplicationStatus);

function statusFor(status: SellerStatus, canApply = false): SellerApplicationStatus {
  return {
    canApply,
    application: {
      storeName: "فروشگاه رویا",
      storeSlug: "roya-fashion",
      description: "پوشاک زنانه",
      status,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

const renderWithToast = (ui: React.ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);

beforeEach(() => {
  replace.mockReset();
  getStatus.mockReset();
});

describe("SellerApplicationStatusView — نمایش وضعیت", () => {
  it("حالت Loading: اسکلت با aria-busy نمایش داده می‌شود", () => {
    getStatus.mockReturnValue(new Promise(() => {}));
    renderWithToast(<SellerApplicationStatusView />);
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it("PENDING", async () => {
    getStatus.mockResolvedValue(statusFor("PENDING"));
    renderWithToast(<SellerApplicationStatusView />);

    expect(await screen.findByText("درخواست فروشندگی شما ثبت شد.")).toBeInTheDocument();
    expect(screen.getByText("در انتظار بررسی")).toBeInTheDocument();
    expect(screen.getByText("فروشگاه رویا")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "ورود به پنل فروشنده" })).not.toBeInTheDocument();
  });

  it("APPROVED: پیام تأیید و CTA ورود به پنل", async () => {
    getStatus.mockResolvedValue(statusFor("APPROVED"));
    renderWithToast(<SellerApplicationStatusView />);

    expect(await screen.findByText("فروشگاه شما تأیید شده است.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ورود به پنل فروشنده" })).toHaveAttribute(
      "href",
      "/seller/dashboard",
    );
  });

  it("REJECTED: پیام رد و امکان ارسال مجدد با فرم پر‌شده", async () => {
    getStatus.mockResolvedValue(statusFor("REJECTED", true));
    const user = userEvent.setup();
    renderWithToast(<SellerApplicationStatusView />);

    expect(await screen.findByText("درخواست فروشندگی شما تأیید نشده است.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /ویرایش و ارسال مجدد/ }));

    expect(screen.getByLabelText(/نام فروشگاه/)).toHaveValue("فروشگاه رویا");
    expect(screen.getByLabelText(/شناسه فروشگاه/)).toHaveValue("roya-fashion");
  });

  it("SUSPENDED: توضیح تعلیق و بدون دکمه ارسال مجدد", async () => {
    getStatus.mockResolvedValue(statusFor("SUSPENDED"));
    renderWithToast(<SellerApplicationStatusView />);

    expect(await screen.findByText("حساب فروشندگی شما تعلیق شده است.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ارسال مجدد/ })).not.toBeInTheDocument();
  });

  it("خطای بارگذاری: ErrorState با تلاش مجدد", async () => {
    getStatus.mockRejectedValueOnce(new Error("boom"));
    getStatus.mockResolvedValueOnce(statusFor("PENDING"));
    const user = userEvent.setup();
    renderWithToast(<SellerApplicationStatusView />);

    await user.click(await screen.findByRole("button", { name: "تلاش مجدد" }));
    expect(await screen.findByText("درخواست فروشندگی شما ثبت شد.")).toBeInTheDocument();
  });

  it("بدون درخواست → هدایت به /seller/apply", async () => {
    getStatus.mockResolvedValue({ application: null, canApply: true });
    renderWithToast(<SellerApplicationStatusView />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/seller/apply"));
  });
});

describe("SellerApplyView — رفتار مسیر", () => {
  it("مشتری بدون درخواست: فرم نمایش داده می‌شود و هدایتی انجام نمی‌شود", async () => {
    getStatus.mockResolvedValue({ application: null, canApply: true });
    renderWithToast(<SellerApplyView />);

    expect(await screen.findByLabelText(/نام فروشگاه/)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("فروشنده تأییدشده → /seller/dashboard", async () => {
    getStatus.mockResolvedValue(statusFor("APPROVED"));
    renderWithToast(<SellerApplyView />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/seller/dashboard"));
    expect(screen.queryByLabelText(/نام فروشگاه/)).not.toBeInTheDocument();
  });

  it.each(["PENDING", "REJECTED", "SUSPENDED"] as const)(
    "%s → صفحه وضعیت",
    async (status) => {
      getStatus.mockResolvedValue(statusFor(status, status === "REJECTED"));
      renderWithToast(<SellerApplyView />);
      await waitFor(() => expect(replace).toHaveBeenCalledWith("/seller/application"));
    },
  );

  it("حساب غیرمجاز (canApply=false و بدون درخواست) فرم نمی‌بیند", async () => {
    getStatus.mockResolvedValue({ application: null, canApply: false });
    renderWithToast(<SellerApplyView />);
    expect(await screen.findByText(/امکان ثبت درخواست فروشندگی/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/نام فروشگاه/)).not.toBeInTheDocument();
  });

  it("خطای شبکه هنگام خواندن وضعیت: ErrorState", async () => {
    getStatus.mockRejectedValue(new Error("network"));
    renderWithToast(<SellerApplyView />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});