// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui";
import { ApiRequestError } from "@/lib/api/client";
import { sellerApi } from "@/lib/api/seller";
import { SellerApplicationForm } from "@/features/seller/SellerApplicationForm";

// config/env.ts در زمان Import خطا می‌دهد اگر این متغیر نباشد؛ hoisted یعنی قبل از Importها اجرا می‌شود
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL ??= "http://localhost:4000/api";
});

// Testing Library بدون globals به‌صورت خودکار پاک‌سازی نمی‌کند
afterEach(cleanup);

vi.mock("@/lib/api/seller", () => ({
  sellerApi: { apply: vi.fn(), getApplicationStatus: vi.fn() },
}));

const apply = vi.mocked(sellerApi.apply);

const application = {
  storeName: "فروشگاه رویا",
  storeSlug: "roya-fashion",
  description: null,
  status: "PENDING" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function setup() {
  const onSubmitted = vi.fn();
  const onStale = vi.fn();
  render(
    <ToastProvider>
      <SellerApplicationForm onSubmitted={onSubmitted} onStale={onStale} />
    </ToastProvider>,
  );
  return { onSubmitted, onStale, user: userEvent.setup() };
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/نام فروشگاه/), "فروشگاه رویا");
  await user.type(screen.getByLabelText(/شناسه فروشگاه/), "Roya-Fashion");
}

const submitButton = () => screen.getByRole("button", { name: /ثبت درخواست فروشندگی/ });

beforeEach(() => {
  apply.mockReset();
});

describe("SellerApplicationForm", () => {
  it("اعتبارسنجی: فرم خالی خطای فارسی نشان می‌دهد و API صدا زده نمی‌شود", async () => {
    const { user } = setup();
    await user.click(submitButton());

    expect(await screen.findByText("نام فروشگاه الزامی است.")).toBeInTheDocument();
    expect(screen.getByText("شناسه فروشگاه الزامی است.")).toBeInTheDocument();
    expect(apply).not.toHaveBeenCalled();
  });

  it("اعتبارسنجی: Slug فارسی/نامعتبر رد می‌شود", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText(/نام فروشگاه/), "فروشگاه رویا");
    await user.type(screen.getByLabelText(/شناسه فروشگاه/), "فروشگاه");
    await user.click(submitButton());

    expect(await screen.findByText(/فقط می‌تواند شامل حروف انگلیسی/)).toBeInTheDocument();
    expect(apply).not.toHaveBeenCalled();
  });

  it("ارسال موفق: داده نرمال‌شده بدون userId/status ارسال و onSubmitted صدا زده می‌شود", async () => {
    apply.mockResolvedValue(application);
    const { user, onSubmitted } = setup();
    await fillValid(user);
    await user.click(submitButton());

    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith({ storeName: "فروشگاه رویا", storeSlug: "roya-fashion" });
    expect(await screen.findByText("درخواست فروشندگی شما ثبت شد")).toBeInTheDocument();
  });

  it("Loading: دکمه هنگام ارسال غیرفعال است و ارسال دوباره فقط یک درخواست می‌فرستد", async () => {
    let resolve: (value: typeof application) => void = () => {};
    apply.mockReturnValue(new Promise((r) => (resolve = r)));
    const { user } = setup();
    await fillValid(user);

    await user.click(submitButton());
    expect(submitButton()).toBeDisabled();
    expect(submitButton()).toHaveAttribute("aria-busy", "true");

    // Submit مستقیم فرم (مثلاً Enter) هم نباید درخواست دوم بفرستد
    fireEvent.submit(screen.getByRole("button", { name: /ثبت درخواست فروشندگی/ }).closest("form")!);
    expect(apply).toHaveBeenCalledTimes(1);

    resolve(application);
    await waitFor(() => expect(submitButton()).not.toBeDisabled());
  });

  it("Slug تکراری از Backend زیر فیلد نمایش داده می‌شود", async () => {
    apply.mockRejectedValue(
      new ApiRequestError(409, "CONFLICT_ERROR", "شناسه فروشگاه باید یکتا باشد.", {
        storeSlug: ["شناسه فروشگاه باید یکتا باشد."],
      }),
    );
    const { user, onSubmitted } = setup();
    await fillValid(user);
    await user.click(submitButton());

    expect(await screen.findByText("شناسه فروشگاه باید یکتا باشد.")).toBeInTheDocument();
    expect(screen.getByLabelText(/شناسه فروشگاه/)).toHaveAttribute("aria-invalid", "true");
    expect(onSubmitted).not.toHaveBeenCalled();
  });

  it("خطای API (500): پیام عمومی نمایش داده می‌شود نه متن خام سرور", async () => {
    apply.mockRejectedValue(new ApiRequestError(500, "INTERNAL_SERVER_ERROR", "PrismaClientKnownRequestError xyz"));
    const { user } = setup();
    await fillValid(user);
    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("ثبت درخواست انجام نشد");
    expect(screen.queryByText(/Prisma/)).not.toBeInTheDocument();
    expect(submitButton()).not.toBeDisabled();
  });

  it("خطای شبکه: پیام اتصال نمایش داده می‌شود", async () => {
    apply.mockRejectedValue(
      new ApiRequestError(0, "NETWORK_ERROR", "ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید."),
    );
    const { user } = setup();
    await fillValid(user);
    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("ارتباط با سرور برقرار نشد");
  });

  it("درخواست تکراری (409 بدون فیلد): هشدار و درخواست خواندن دوباره وضعیت", async () => {
    apply.mockRejectedValue(
      new ApiRequestError(409, "CONFLICT_ERROR", "درخواست فروشندگی شما قبلاً ثبت شده و در انتظار بررسی است."),
    );
    const { user, onStale } = setup();
    await fillValid(user);
    await user.click(submitButton());

    await waitFor(() => expect(onStale).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/قبلاً ثبت شده و در انتظار بررسی/)).toBeInTheDocument();
  });
});