// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  SellerOrderDetail,
  SellerOrderList,
  SellerOrderListItem,
  SellerOrdersOverview,
} from "@vista/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui";
import { SellerOrderDetailView } from "@/features/sellerOrders/SellerOrderDetailView";
import { SellerOrdersView } from "@/features/sellerOrders/SellerOrdersView";
import { ApiRequestError } from "@/lib/api/client";
import { sellerOrdersApi } from "@/lib/api/sellerOrders";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL ??= "http://localhost:4000/api";
});

afterEach(cleanup);

vi.mock("next/navigation", () => ({ usePathname: () => "/seller/orders" }));
vi.mock("@/lib/api/sellerOrders", () => ({
  sellerOrdersApi: { list: vi.fn(), overview: vi.fn(), detail: vi.fn(), updateStatus: vi.fn() },
}));

const api = vi.mocked(sellerOrdersApi);
const SO1 = "00000000-0000-4000-8000-000000000001";
const SO2 = "00000000-0000-4000-8000-000000000002";

function makeListItem(overrides: Partial<SellerOrderListItem> = {}): SellerOrderListItem {
  return {
    id: SO1,
    orderNumber: 1001,
    createdAt: "2026-10-01T09:30:00.000Z",
    status: "PENDING",
    subtotal: 1_000_000,
    itemCount: 2,
    previewImageUrl: null,
    trackingCode: null,
    ...overrides,
  };
}

function makeList(items: SellerOrderListItem[], pagination?: Partial<SellerOrderList["pagination"]>): SellerOrderList {
  return { data: items, pagination: { page: 1, limit: 10, total: items.length, totalPages: 1, ...pagination } };
}

const OVERVIEW: SellerOrdersOverview = {
  byStatus: {
    PENDING: { count: 3, total: 3_000_000 },
    PROCESSING: { count: 2, total: 1_500_000 },
    SHIPPED: { count: 1, total: 500_000 },
    DELIVERED: { count: 7, total: 9_000_000 },
    CANCELLED: { count: 0, total: 0 },
  },
  totalOrders: 13,
};

function makeDetail(overrides: Partial<SellerOrderDetail> = {}): SellerOrderDetail {
  return {
    id: SO1,
    orderNumber: 1001,
    createdAt: "2026-10-01T09:30:00.000Z",
    updatedAt: "2026-10-01T09:30:00.000Z",
    paidAt: "2026-10-01T09:31:00.000Z",
    status: "PROCESSING",
    subtotal: 1_000_000,
    trackingCode: null,
    shippedAt: null,
    deliveredAt: null,
    items: [
      { id: "i1", productTitle: "کت پشمی", sku: "COAT-BLK-M", size: "M", color: "مشکی", imageUrl: null, quantity: 2, unitPrice: 500_000, lineTotal: 1_000_000 },
    ],
    shipping: { fullName: "مینا نمونه", phone: "09120000000", province: "تهران", city: "تهران", postalCode: "1234567890", addressLine: "خیابان نمونه، پلاک ۱" },
    allowedTransitions: ["SHIPPED"],
    history: [{ id: "e1", fromStatus: "PENDING", toStatus: "PROCESSING", trackingCode: null, createdAt: "2026-10-01T10:00:00.000Z" }],
    ...overrides,
  };
}

const withToast = (ui: React.ReactNode) => render(<ToastProvider>{ui}</ToastProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
  api.overview.mockResolvedValue(OVERVIEW);
  api.list.mockResolvedValue(makeList([makeListItem(), makeListItem({ id: SO2, orderNumber: 1002, status: "SHIPPED", subtotal: 250_000, itemCount: 1 })]));
});

describe("فهرست سفارش‌ها", () => {
  it("1) در حال بارگذاری: اسکلت فهرست و خلاصه", () => {
    api.list.mockReturnValue(new Promise(() => undefined));
    api.overview.mockReturnValue(new Promise(() => undefined));
    withToast(<SellerOrdersView />);
    expect(screen.getByLabelText("در حال بارگذاری سفارش‌ها")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByLabelText("در حال بارگذاری خلاصه سفارش‌ها")).toBeInTheDocument();
  });

  it("2) خطا: پیام فارسی (بدون متن خام) و «تلاش مجدد»", async () => {
    const user = userEvent.setup();
    api.list.mockRejectedValueOnce(new Error("stack trace boom"));
    withToast(<SellerOrdersView />);
    expect(await screen.findByText("دریافت سفارش‌ها انجام نشد.")).toBeInTheDocument();
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "تلاش مجدد" })[0]!);
    expect(await screen.findByRole("list", { name: "فهرست سفارش‌ها" })).toBeInTheDocument();
  });

  it("3) خالی: بدون فیلتر پیام «هنوز سفارشی ندارید»؛ با فیلتر پیام جستجو", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue(makeList([]));
    withToast(<SellerOrdersView />);
    expect(await screen.findByText("هنوز سفارشی ندارید")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ارسال‌شده" }));
    expect(await screen.findByText("سفارشی با این فیلتر پیدا نشد")).toBeInTheDocument();
  });

  it("3b) 403: پیام سرور و لینک وضعیت درخواست", async () => {
    api.list.mockRejectedValue(new ApiRequestError(403, "AUTHORIZATION_ERROR", "حساب فروشندگی شما هنوز تأیید نشده است"));
    withToast(<SellerOrdersView />);
    expect(await screen.findByText("حساب فروشندگی شما هنوز تأیید نشده است")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "وضعیت درخواست فروشندگی" })).toBeInTheDocument();
  });

  it("4) خلاصه از بک‌اند: چهار وضعیت با شمارش و مبلغ", async () => {
    withToast(<SellerOrdersView />);
    const summary = await screen.findByRole("region", { name: "خلاصه سفارش‌ها" });
    for (const [label, count] of [["در انتظار آماده‌سازی", "۳"], ["در حال آماده‌سازی", "۲"], ["ارسال‌شده", "۱"], ["تحویل‌شده", "۷"]] as const) {
      const card = within(summary).getByText(label).closest("div")!;
      expect(within(card).getByText(count)).toBeInTheDocument();
    }
    expect(within(summary).getByText(/۹٬۰۰۰٬۰۰۰ تومان/)).toBeInTheDocument();
  });

  it("4b) خطای خلاصه، فهرست را خراب نمی‌کند", async () => {
    api.overview.mockRejectedValue(new Error("x"));
    withToast(<SellerOrdersView />);
    expect(await screen.findByText("دریافت خلاصه سفارش‌ها انجام نشد.")).toBeInTheDocument();
    expect(await screen.findByRole("list", { name: "فهرست سفارش‌ها" })).toBeInTheDocument();
  });

  it("5) ردیف‌ها: شماره، تعداد، مبلغ فروشنده، وضعیت فارسی و لینک جزئیات", async () => {
    withToast(<SellerOrdersView />);
    const list = await screen.findByRole("list", { name: "فهرست سفارش‌ها" });
    expect(within(list).getByRole("heading", { name: /۱٬۰۰۱/ })).toBeInTheDocument();
    expect(within(list).getByText("۱٬۰۰۰٬۰۰۰ تومان")).toBeInTheDocument();
    expect(within(list).getByText("۲ عدد")).toBeInTheDocument();
    expect(within(list).getByText("در انتظار آماده‌سازی")).toBeInTheDocument();
    expect(within(list).getByText("ارسال‌شده")).toBeInTheDocument();
    expect(within(list).getByRole("link", { name: "مشاهده جزئیات سفارش ۱٬۰۰۱" })).toHaveAttribute("href", `/seller/orders/${SO1}`);
    const card = within(list).getByRole("heading", { name: /۱٬۰۰۱/ }).closest("article")!;
    expect(card.className).toMatch(/flex-col/);
    expect(card.className).toMatch(/md:grid/);
  });
});

describe("جستجو، فیلتر و صفحه‌بندی", () => {
  it("6) فیلتر وضعیت به سرور می‌رود و aria-pressed دارد", async () => {
    const user = userEvent.setup();
    withToast(<SellerOrdersView />);
    await screen.findByRole("list", { name: "فهرست سفارش‌ها" });
    await user.click(screen.getByRole("button", { name: "در حال آماده‌سازی" }));
    await waitFor(() =>
      expect(api.list).toHaveBeenLastCalledWith({ page: 1, limit: 10, status: "PROCESSING", q: undefined, from: undefined, to: undefined }),
    );
    expect(screen.getByRole("button", { name: "در حال آماده‌سازی" })).toHaveAttribute("aria-pressed", "true");
  });

  it("7) شماره سفارش با ارقام فارسی و بازه تاریخ همراه با هم ارسال می‌شود", async () => {
    const user = userEvent.setup();
    withToast(<SellerOrdersView />);
    await screen.findByRole("list", { name: "فهرست سفارش‌ها" });
    await user.type(screen.getByLabelText("شماره سفارش"), "۱۰۰۱");
    await user.type(screen.getByLabelText("از تاریخ"), "2026-10-01");
    await user.type(screen.getByLabelText("تا تاریخ"), "2026-10-09");
    await user.click(screen.getByRole("button", { name: "اعمال فیلتر" }));
    await waitFor(() =>
      expect(api.list).toHaveBeenLastCalledWith({ page: 1, limit: 10, status: undefined, q: "1001", from: "2026-10-01", to: "2026-10-09" }),
    );
    // پاک‌کردن فیلترها
    await user.click(screen.getByRole("button", { name: "پاک‌کردن" }));
    await waitFor(() =>
      expect(api.list).toHaveBeenLastCalledWith({ page: 1, limit: 10, status: undefined, q: undefined, from: undefined, to: undefined }),
    );
    expect(screen.getByLabelText("شماره سفارش")).toHaveValue("");
  });

  it("8) اعتبارسنجی: شماره غیرعددی و بازه معکوس درخواستی نمی‌فرستد", async () => {
    const user = userEvent.setup();
    withToast(<SellerOrdersView />);
    await screen.findByRole("list", { name: "فهرست سفارش‌ها" });
    const calls = api.list.mock.calls.length;
    await user.type(screen.getByLabelText("شماره سفارش"), "abc");
    await user.type(screen.getByLabelText("از تاریخ"), "2026-10-09");
    await user.type(screen.getByLabelText("تا تاریخ"), "2026-10-01");
    await user.click(screen.getByRole("button", { name: "اعمال فیلتر" }));
    expect(screen.getByText("شماره سفارش باید فقط عدد باشد")).toBeInTheDocument();
    expect(screen.getByText("تاریخ پایان نباید قبل از شروع باشد")).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledTimes(calls);
  });

  it("9) صفحه‌بندی صفحه بعد را از سرور می‌گیرد", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue(makeList([makeListItem()], { total: 25, totalPages: 3 }));
    withToast(<SellerOrdersView />);
    await screen.findByRole("list", { name: "فهرست سفارش‌ها" });
    await user.click(screen.getByRole("button", { name: /۲/ }));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
  });
});

describe("جزئیات سفارش", () => {
  it("10) فقط اقلام فروشنده، SKU، مبلغ‌ها، آدرس ارسال و تاریخچه نمایش داده می‌شود", async () => {
    api.detail.mockResolvedValue(makeDetail());
    withToast(<SellerOrderDetailView sellerOrderId={SO1} />);
    expect(await screen.findByRole("heading", { name: /سفارش ۱٬۰۰۱/ })).toBeInTheDocument();
    const items = screen.getByRole("list", { name: "اقلام سفارش" });
    expect(within(items).getByText("کت پشمی")).toBeInTheDocument();
    expect(within(items).getByText("SKU: COAT-BLK-M")).toBeInTheDocument();
    expect(within(items).getByText("۲ × ۵۰۰٬۰۰۰ تومان")).toBeInTheDocument();
    expect(screen.getByText("جمع اقلام شما").parentElement).toHaveTextContent("۱٬۰۰۰٬۰۰۰ تومان");
    expect(screen.getByText("مینا نمونه")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "تاریخچه تغییر وضعیت" })).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it("10b) سفارش لغوشده: بدون آدرس و بدون دکمه اقدام", async () => {
    api.detail.mockResolvedValue(makeDetail({ status: "CANCELLED", shipping: null, allowedTransitions: [] }));
    withToast(<SellerOrderDetailView sellerOrderId={SO1} />);
    await screen.findByRole("heading", { name: /سفارش ۱٬۰۰۱/ });
    expect(screen.queryByText("اطلاعات ارسال")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "اقدام بعدی" })).not.toBeInTheDocument();
  });

  it("11) ۴۰۴: پیام «سفارش یافت نشد» و بازگشت؛ بدون افشای وجود", async () => {
    api.detail.mockRejectedValue(new ApiRequestError(404, "NOT_FOUND_ERROR", "سفارش یافت نشد"));
    withToast(<SellerOrderDetailView sellerOrderId={SO1} />);
    expect(await screen.findByText("سفارش یافت نشد")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "بازگشت به سفارش‌ها" })).toHaveAttribute("href", "/seller/orders");
  });

  it("11b) خطای شبکه/سرور: پیام و تلاش مجدد", async () => {
    const user = userEvent.setup();
    api.detail.mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce(makeDetail());
    withToast(<SellerOrderDetailView sellerOrderId={SO1} />);
    expect(await screen.findByText("دریافت سفارش انجام نشد.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "تلاش مجدد" }));
    expect(await screen.findByRole("heading", { name: /سفارش ۱٬۰۰۱/ })).toBeInTheDocument();
  });
});

describe("تغییر وضعیت", () => {
  async function openShip(user: ReturnType<typeof userEvent.setup>) {
    api.detail.mockResolvedValue(makeDetail());
    withToast(<SellerOrderDetailView sellerOrderId={SO1} />);
    await user.click(await screen.findByRole("button", { name: "ثبت ارسال" }));
    return screen.getByRole("dialog", { name: "ثبت ارسال" });
  }

  it("12) دکمه‌ها همان allowedTransitions سرور هستند", async () => {
    api.detail.mockResolvedValue(makeDetail({ status: "PENDING", allowedTransitions: ["PROCESSING"] }));
    withToast(<SellerOrderDetailView sellerOrderId={SO1} />);
    expect(await screen.findByRole("button", { name: "شروع آماده‌سازی" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ثبت ارسال" })).not.toBeInTheDocument();
  });

  it("13) ارسال: تأیید صریح لازم است؛ بدون کد رهگیری یا با کد نامعتبر درخواستی نمی‌رود", async () => {
    const user = userEvent.setup();
    const dialog = await openShip(user);
    expect(within(dialog).getByText(/برگشت‌پذیر نیست/)).toBeInTheDocument();
    expect(api.updateStatus).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "تأیید" }));
    expect(within(dialog).getByText("کد رهگیری الزامی است")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/کد رهگیری/), "ab");
    await user.click(within(dialog).getByRole("button", { name: "تأیید" }));
    expect(within(dialog).getByText("کد رهگیری باید حداقل ۴ کاراکتر باشد")).toBeInTheDocument();
    expect(api.updateStatus).not.toHaveBeenCalled();
  });

  it("14) موفقیت: API با وضعیت و کد (ارقام لاتین) صدا می‌خورد و صفحه با پاسخ سرور به‌روز می‌شود", async () => {
    const user = userEvent.setup();
    api.updateStatus.mockResolvedValue(
      makeDetail({ status: "SHIPPED", trackingCode: "1234567890", allowedTransitions: ["DELIVERED"] }),
    );
    const dialog = await openShip(user);
    await user.type(within(dialog).getByLabelText(/کد رهگیری/), "۱۲۳۴۵۶۷۸۹۰");
    await user.click(within(dialog).getByRole("button", { name: "تأیید" }));

    await waitFor(() => expect(api.updateStatus).toHaveBeenCalledWith(SO1, { status: "SHIPPED", trackingCode: "1234567890" }));
    expect(await screen.findByText("وضعیت سفارش به‌روز شد")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "ثبت تحویل" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ثبت ارسال" })).not.toBeInTheDocument();
  });

  it("15) ارسال دوباره در حین انجام: فقط یک درخواست و دکمه غیرفعال", async () => {
    const user = userEvent.setup();
    let resolve!: (value: SellerOrderDetail) => void;
    api.updateStatus.mockReturnValue(new Promise((r) => (resolve = r)));
    const dialog = await openShip(user);
    await user.type(within(dialog).getByLabelText(/کد رهگیری/), "TRACK1234");
    const confirm = within(dialog).getByRole("button", { name: "تأیید" });
    await user.dblClick(confirm);
    expect(api.updateStatus).toHaveBeenCalledTimes(1);
    expect(confirm).toBeDisabled();
    resolve(makeDetail({ status: "SHIPPED", allowedTransitions: ["DELIVERED"] }));
    expect(await screen.findByRole("button", { name: "ثبت تحویل" })).toBeInTheDocument();
  });

  it("16) تداخل (409، داده کهنه): پیام سرور، بسته‌شدن دیالوگ و خواندن مجدد وضعیت واقعی", async () => {
    const user = userEvent.setup();
    api.updateStatus.mockRejectedValue(new ApiRequestError(409, "CONFLICT_ERROR", "این تغییر وضعیت قبلاً ثبت شده است؛ صفحه را تازه کنید"));
    const dialog = await openShip(user);
    // سرور در بازخوانی، وضعیت واقعی (ارسال‌شده توسط تب دیگر) را برمی‌گرداند
    api.detail.mockResolvedValue(makeDetail({ status: "SHIPPED", trackingCode: "OTHERTAB1", allowedTransitions: ["DELIVERED"] }));
    await user.type(within(dialog).getByLabelText(/کد رهگیری/), "TRACK1234");
    await user.click(within(dialog).getByRole("button", { name: "تأیید" }));

    expect(await screen.findByText("این تغییر وضعیت قبلاً ثبت شده است؛ صفحه را تازه کنید")).toBeInTheDocument();
    await waitFor(() => expect(api.detail).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("button", { name: "ثبت تحویل" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "ثبت ارسال" })).not.toBeInTheDocument();
  });

  it("17) خطای سرور ۵۰۰: پیام عمومی در دیالوگ و فرم باز می‌ماند", async () => {
    const user = userEvent.setup();
    api.updateStatus.mockRejectedValue(new ApiRequestError(500, "INTERNAL", "stack trace: at Object.<anonymous>"));
    const dialog = await openShip(user);
    await user.type(within(dialog).getByLabelText(/کد رهگیری/), "TRACK1234");
    await user.click(within(dialog).getByRole("button", { name: "تأیید" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("عملیات انجام نشد. لطفاً دوباره تلاش کنید.");
    expect(screen.queryByText(/stack trace/)).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "ثبت ارسال" })).toBeInTheDocument();
  });

  it("18) خطای ۴۰۰ فیلد کد رهگیری از سرور روی همان فیلد نمایش داده می‌شود", async () => {
    const user = userEvent.setup();
    api.updateStatus.mockRejectedValue(new ApiRequestError(400, "VALIDATION_ERROR", "داده‌های ارسالی معتبر نیستند", { trackingCode: ["کد رهگیری معتبر نیست"] }));
    const dialog = await openShip(user);
    await user.type(within(dialog).getByLabelText(/کد رهگیری/), "TRACK1234");
    await user.click(within(dialog).getByRole("button", { name: "تأیید" }));
    expect(await within(dialog).findAllByText("کد رهگیری معتبر نیست")).not.toHaveLength(0);
  });

  it("19) شروع آماده‌سازی و ثبت تحویل بدون کد رهگیری و با تأیید ارسال می‌شوند", async () => {
    const user = userEvent.setup();
    api.detail.mockResolvedValue(makeDetail({ status: "PENDING", allowedTransitions: ["PROCESSING"] }));
    api.updateStatus.mockResolvedValue(makeDetail({ status: "PROCESSING", allowedTransitions: ["SHIPPED"] }));
    withToast(<SellerOrderDetailView sellerOrderId={SO1} />);
    await user.click(await screen.findByRole("button", { name: "شروع آماده‌سازی" }));
    const dialog = screen.getByRole("dialog", { name: "شروع آماده‌سازی" });
    expect(within(dialog).queryByLabelText(/کد رهگیری/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "تأیید" }));
    await waitFor(() => expect(api.updateStatus).toHaveBeenCalledWith(SO1, { status: "PROCESSING" }));
    expect(await screen.findByRole("button", { name: "ثبت ارسال" })).toBeInTheDocument();
  });
});
