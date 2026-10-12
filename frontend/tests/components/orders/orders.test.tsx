// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AddressSummary, CartSummary, OrderDetail, OrderListItem } from "@vista/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui";
import { CheckoutView } from "@/features/checkout/CheckoutView";
import { OrderDetailView } from "@/features/orders/OrderDetailView";
import { OrdersListView } from "@/features/orders/OrdersListView";
import { addressesApi } from "@/lib/api/addresses";
import { cartApi } from "@/lib/api/cart";
import { ApiRequestError } from "@/lib/api/client";
import { ordersApi } from "@/lib/api/orders";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL ??= "http://localhost:4000/api";
});

afterEach(cleanup);

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/checkout" }));
vi.mock("@/lib/api/orders", () => ({
  ordersApi: { checkout: vi.fn(), list: vi.fn(), getById: vi.fn(), cancel: vi.fn() },
}));
vi.mock("@/lib/api/cart", () => ({ cartApi: { get: vi.fn() } }));
vi.mock("@/lib/api/addresses", () => ({ addressesApi: { list: vi.fn(), create: vi.fn() } }));

const orders = vi.mocked(ordersApi);
const cart = vi.mocked(cartApi);
const addresses = vi.mocked(addressesApi);

const ADDR1 = "00000000-0000-4000-8000-0000000000a1";
const ADDR2 = "00000000-0000-4000-8000-0000000000a2";
const ORDER_ID = "00000000-0000-4000-8000-0000000000b1";
const VARIANT = "00000000-0000-4000-8000-0000000000c1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const ADDRESS_LIST: AddressSummary[] = [
  { id: ADDR1, fullName: "مینا نمونه", phone: "09120000000", province: "تهران", city: "تهران", postalCode: "1234567890", addressLine: "خیابان اول", isDefault: true },
  { id: ADDR2, fullName: "علی نمونه", phone: "09121111111", province: "البرز", city: "کرج", postalCode: "3123456789", addressLine: "خیابان دوم", isDefault: false },
];

function makeCart(overrides: Partial<CartSummary["items"][number]> = {}, subtotal = 2_000_000): CartSummary {
  return {
    items: [
      {
        variantId: VARIANT, productId: "p1", productSlug: "coat", productTitle: "کت پشمی", imageUrl: null,
        size: "M", color: "مشکی", quantity: 2, unitPrice: subtotal / 2, lineTotal: subtotal,
        availableStock: 5, isAvailable: true, ...overrides,
      },
    ],
    itemCount: 2,
    subtotal,
  };
}

function makeOrder(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: ORDER_ID, orderNumber: 1001, status: "PENDING",
    subtotal: 2_000_000, shippingCost: 0, discountAmount: 0, totalAmount: 2_000_000,
    shippingAddress: { fullName: "مینا نمونه", phone: "09120000000", province: "تهران", city: "تهران", postalCode: "1234567890", addressLine: "خیابان اول" },
    sellerOrders: [
      {
        id: "so1", sellerStoreName: "فروشگاه الف", status: "PENDING", subtotal: 2_000_000,
        trackingCode: null, shippedAt: null, deliveredAt: null,
        items: [{ id: "i1", productSlug: "coat", productTitle: "کت پشمی", size: "M", color: "مشکی", imageUrl: null, quantity: 2, unitPrice: 1_000_000, lineTotal: 2_000_000 }],
      },
    ],
    fulfillment: { state: "PENDING", totalParcels: 1, shippedParcels: 0, deliveredParcels: 0 },
    canCancel: true,
    createdAt: "2026-10-11T10:00:00.000Z", paidAt: null, cancelledAt: null,
    ...overrides,
  };
}

function makeListItem(overrides: Partial<OrderListItem> = {}): OrderListItem {
  return {
    id: ORDER_ID, orderNumber: 1001, status: "PENDING", totalAmount: 2_000_000, itemCount: 2,
    previewImageUrl: null,
    fulfillment: { state: "PENDING", totalParcels: 1, shippedParcels: 0, deliveredParcels: 0 },
    canCancel: true, createdAt: "2026-10-11T10:00:00.000Z",
    ...overrides,
  };
}

const withToast = (ui: React.ReactNode) => render(<ToastProvider>{ui}</ToastProvider>);
const submitButton = (name = /تأیید و ثبت سفارش/) => screen.getByRole("button", { name });

beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
  cart.get.mockResolvedValue(makeCart());
  addresses.list.mockResolvedValue(ADDRESS_LIST);
  orders.checkout.mockResolvedValue(makeOrder());
  orders.list.mockResolvedValue({ data: [makeListItem()], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } });
  orders.getById.mockResolvedValue(makeOrder());
});

describe("Checkout", () => {
  it("1) بارگذاری: اسکلت با aria-busy", () => {
    cart.get.mockReturnValue(new Promise(() => undefined));
    const { container } = withToast(<CheckoutView />);
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
  });

  it("2) سبد خالی و خطای بارگذاری", async () => {
    cart.get.mockResolvedValueOnce({ items: [], itemCount: 0, subtotal: 0 });
    const { unmount } = withToast(<CheckoutView />);
    expect(await screen.findByText("سبد خرید شما خالی است")).toBeInTheDocument();
    unmount();
    cart.get.mockRejectedValueOnce(new Error("boom"));
    withToast(<CheckoutView />);
    expect(await screen.findByText("مشکلی پیش آمد")).toBeInTheDocument();
  });

  it("3) مرور سفارش: مراحل، کالاها، مبلغ و آدرس پیش‌فرض انتخاب‌شده", async () => {
    withToast(<CheckoutView />);
    expect(await screen.findByText("مرور سفارش")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "مراحل ثبت سفارش" })).toBeInTheDocument();
    expect(screen.getByText("کت پشمی")).toBeInTheDocument();
    expect(screen.getAllByText(/۲٬۰۰۰٬۰۰۰ تومان/).length).toBeGreaterThan(0);
    expect(screen.getByRole("radio", { name: /مینا نمونه/ })).toBeChecked();
    expect(submitButton()).toBeEnabled();
  });

  it("4) بدون آدرس دکمهٔ ثبت غیرفعال است", async () => {
    addresses.list.mockResolvedValue([]);
    withToast(<CheckoutView />);
    expect(await screen.findByText("هنوز آدرسی ثبت نکرده‌اید.")).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it("5) ثبت موفق: checkoutKey (UUID)، آدرس و مبلغ دیده‌شده ارسال و به جزئیات سفارش هدایت می‌شود", async () => {
    const user = userEvent.setup();
    withToast(<CheckoutView />);
    await user.click(await screen.findByRole("button", { name: /تأیید و ثبت سفارش/ }));
    await waitFor(() => expect(orders.checkout).toHaveBeenCalledTimes(1));
    const input = orders.checkout.mock.calls[0]?.[0];
    expect(input).toMatchObject({ addressId: ADDR1, expectedTotal: 2_000_000 });
    expect(input?.checkoutKey).toMatch(UUID_RE);
    expect(router.replace).toHaveBeenCalledWith(`/orders/${ORDER_ID}?placed=1`);
    expect(router.refresh).toHaveBeenCalled();
  });

  it("6) جلوگیری از ثبت دوباره: دو کلیک سریع = یک درخواست و دکمه تا پایان قفل است", async () => {
    const user = userEvent.setup();
    let resolve!: (order: OrderDetail) => void;
    orders.checkout.mockReturnValue(new Promise((r) => (resolve = r)));
    withToast(<CheckoutView />);
    const button = await screen.findByRole("button", { name: /تأیید و ثبت سفارش/ });
    await user.dblClick(button);
    await user.click(button);
    expect(orders.checkout).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    resolve(makeOrder());
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    expect(orders.checkout).toHaveBeenCalledTimes(1);
  });

  it("7) خطای شبکه/۵xx: تلاش مجدد با «همان» checkoutKey؛ تغییر آدرس کلید جدید می‌سازد", async () => {
    const user = userEvent.setup();
    orders.checkout
      .mockRejectedValueOnce(new ApiRequestError(0, "NETWORK_ERROR", "ارتباط با سرور برقرار نشد"))
      .mockRejectedValueOnce(new ApiRequestError(500, "INTERNAL_SERVER_ERROR", "stack trace secret"))
      .mockRejectedValueOnce(new ApiRequestError(0, "NETWORK_ERROR", "ارتباط با سرور برقرار نشد"));
    withToast(<CheckoutView />);
    await user.click(await screen.findByRole("button", { name: /تأیید و ثبت سفارش/ }));
    expect(await screen.findByText(/سفارش تکراری ساخته نمی‌شود/)).toBeInTheDocument();
    await user.click(submitButton());
    await waitFor(() => expect(orders.checkout).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/stack trace secret/)).not.toBeInTheDocument();
    const [first, second] = orders.checkout.mock.calls.map((c) => c[0].checkoutKey);
    expect(second).toBe(first);

    await user.click(screen.getByRole("radio", { name: /علی نمونه/ }));
    await user.click(submitButton());
    await waitFor(() => expect(orders.checkout).toHaveBeenCalledTimes(3));
    const third = orders.checkout.mock.calls[2]?.[0];
    expect(third?.addressId).toBe(ADDR2);
    expect(third?.checkoutKey).not.toBe(first);
  });

  it("8) تغییر قیمت: سبد تازه می‌شود، مبلغ جدید با هشدار نشان داده و فقط بعد از تأیید دوباره ارسال می‌شود", async () => {
    const user = userEvent.setup();
    orders.checkout
      .mockRejectedValueOnce(
        new ApiRequestError(409, "CHECKOUT_PRICE_CHANGED", "قیمت تغییر کرده است", {
          expectedTotal: ["2000000"],
          actualTotal: ["2400000"],
        }),
      )
      .mockResolvedValueOnce(makeOrder({ totalAmount: 2_400_000 }));
    cart.get.mockResolvedValueOnce(makeCart()).mockResolvedValue(makeCart({}, 2_400_000));
    withToast(<CheckoutView />);
    await user.click(await screen.findByRole("button", { name: /تأیید و ثبت سفارش/ }));
    const notice = await screen.findByText(/قیمت‌ها تغییر کرده است/);
    expect(notice).toHaveTextContent("۲٬۴۰۰٬۰۰۰ تومان");
    expect(orders.checkout).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "تأیید مبلغ جدید و ثبت سفارش" }));
    await waitFor(() => expect(orders.checkout).toHaveBeenCalledTimes(2));
    expect(orders.checkout.mock.calls[1]?.[0].expectedTotal).toBe(2_400_000);
    expect(orders.checkout.mock.calls[1]?.[0].checkoutKey).not.toBe(orders.checkout.mock.calls[0]?.[0].checkoutKey);
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
  });

  it("9) موجودی ناکافی: پیام، علامت «ناموجود» روی کالا و دکمهٔ ثبت غیرفعال", async () => {
    const user = userEvent.setup();
    orders.checkout.mockRejectedValueOnce(
      new ApiRequestError(409, "CHECKOUT_ITEMS_UNAVAILABLE", "برخی کالاهای سبد خرید در دسترس نیستند: کت پشمی (موجودی کافی ندارد)", {
        [VARIANT]: ["INSUFFICIENT_STOCK", "1"],
      }),
    );
    cart.get.mockResolvedValueOnce(makeCart()).mockResolvedValue(makeCart({ availableStock: 1, isAvailable: false }));
    withToast(<CheckoutView />);
    await user.click(await screen.findByRole("button", { name: /تأیید و ثبت سفارش/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("در دسترس نیستند");
    expect(await screen.findByText("ناموجود")).toBeInTheDocument();
    expect(screen.getByText(/فقط ۱ عدد موجود است/)).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("10) نشست منقضی (۴۰۱): پیام و پیوند ورود؛ آدرس نامعتبر (۴۰۴) پیام مناسب", async () => {
    const user = userEvent.setup();
    orders.checkout
      .mockRejectedValueOnce(new ApiRequestError(401, "AUTHENTICATION_ERROR", "x"))
      .mockRejectedValueOnce(new ApiRequestError(404, "NOT_FOUND_ERROR", "آدرس یافت نشد"));
    withToast(<CheckoutView />);
    await user.click(await screen.findByRole("button", { name: /تأیید و ثبت سفارش/ }));
    expect(await screen.findByText(/نشست شما منقضی شده است/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ورود به حساب کاربری" })).toHaveAttribute("href", "/login?next=/checkout");
    await user.click(submitButton());
    expect(await screen.findByText(/آدرس انتخاب‌شده یافت نشد/)).toBeInTheDocument();
  });
});

describe("فهرست سفارش‌ها", () => {
  it("11) بارگذاری و نمایش: شمارهٔ سفارش، وضعیت پرداخت و وضعیت ارسال جدا", async () => {
    orders.list.mockResolvedValue({
      data: [makeListItem({ status: "PAID", fulfillment: { state: "PARTIALLY_SHIPPED", totalParcels: 2, shippedParcels: 1, deliveredParcels: 0 } })],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    withToast(<OrdersListView />);
    expect(await screen.findByText(/سفارش #۱٬۰۰۱/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /سفارش #۱٬۰۰۱/ });
    expect(link).toHaveAttribute("href", `/orders/${ORDER_ID}`);
    expect(within(link).getByText("پرداخت‌شده")).toBeInTheDocument();
    expect(within(link).getByText("بخشی از بسته‌ها ارسال شده")).toBeInTheDocument();
  });

  it("12) حالت خالی (همه / فیلتر) و خطا با تلاش مجدد", async () => {
    const user = userEvent.setup();
    orders.list.mockResolvedValue({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } });
    const { unmount } = withToast(<OrdersListView />);
    expect(await screen.findByText("هنوز سفارشی ثبت نکرده‌اید")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "لغوشده" }));
    expect(await screen.findByText("سفارشی با این وضعیت پیدا نشد")).toBeInTheDocument();
    unmount();

    orders.list.mockReset();
    orders.list.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ data: [makeListItem()], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } });
    withToast(<OrdersListView />);
    await user.click(await screen.findByRole("button", { name: "تلاش مجدد" }));
    expect(await screen.findByText(/سفارش #۱٬۰۰۱/)).toBeInTheDocument();
    expect(orders.list).toHaveBeenCalledTimes(2);
  });

  it("13) فیلتر وضعیت: درخواست با status و بازگشت به صفحهٔ ۱", async () => {
    const user = userEvent.setup();
    withToast(<OrdersListView />);
    await screen.findByText(/سفارش #۱٬۰۰۱/);
    await user.click(screen.getByRole("button", { name: "در انتظار پرداخت" }));
    await waitFor(() => expect(orders.list).toHaveBeenLastCalledWith(1, "PENDING"));
    expect(screen.getByRole("button", { name: "در انتظار پرداخت" })).toHaveAttribute("aria-pressed", "true");
  });

  it("14) دسترسی غیرمجاز (۴۰۱) → پیام و پیوند ورود", async () => {
    orders.list.mockRejectedValue(new ApiRequestError(401, "AUTHENTICATION_ERROR", "x"));
    withToast(<OrdersListView />);
    expect(await screen.findByText("نشست شما منقضی شده است")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ورود به حساب کاربری" })).toHaveAttribute("href", "/login?next=/orders");
  });
});

describe("جزئیات سفارش و لغو", () => {
  it("15) نمایش کالاها، آدرس، مبلغ، کد رهگیری و پیشرفت ارسال", async () => {
    const [baseSeller] = makeOrder().sellerOrders;
    if (!baseSeller) throw new Error("fixture");
    orders.getById.mockResolvedValue(
      makeOrder({
        status: "PAID",
        canCancel: false,
        paidAt: "2026-10-11T10:05:00.000Z",
        fulfillment: { state: "PARTIALLY_SHIPPED", totalParcels: 2, shippedParcels: 1, deliveredParcels: 0 },
        sellerOrders: [
          { ...baseSeller, status: "SHIPPED", trackingCode: "TRK-777", shippedAt: "2026-10-12T08:00:00.000Z" },
          { ...baseSeller, id: "so2", sellerStoreName: "فروشگاه ب", status: "PROCESSING" },
        ],
      }),
    );
    withToast(<OrderDetailView orderId={ORDER_ID} />);
    expect(await screen.findByRole("heading", { name: /۱٬۰۰۱/ })).toBeInTheDocument();
    expect(screen.getByText("TRK-777")).toBeInTheDocument();
    expect(screen.getByText(/۱ از ۲ بسته ارسال شده است/)).toBeInTheDocument();
    expect(screen.getAllByText("کت پشمی").length).toBe(2);
    expect(screen.getByText(/خیابان اول/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "لغو سفارش" })).not.toBeInTheDocument();
  });

  it("16) پیام ثبت موفق (?placed) و یادداشت «در انتظار پرداخت»", async () => {
    withToast(<OrderDetailView orderId={ORDER_ID} justPlaced />);
    expect(await screen.findByText(/سفارش شما ثبت شد/)).toBeInTheDocument();
    expect(screen.getByText(/پرداخت آن هنوز تأیید نشده است/)).toBeInTheDocument();
    expect(screen.getByText(/فروشنده‌ها تا تأیید پرداخت/)).toBeInTheDocument();
  });

  it("17) سفارش دیگران/ناموجود (۴۰۴) و نشست منقضی (۴۰۱) و خطای عمومی", async () => {
    orders.getById.mockRejectedValueOnce(new ApiRequestError(404, "NOT_FOUND_ERROR", "x"));
    const first = withToast(<OrderDetailView orderId={ORDER_ID} />);
    expect(await screen.findByText("سفارش پیدا نشد")).toBeInTheDocument();
    first.unmount();
    orders.getById.mockRejectedValueOnce(new ApiRequestError(401, "AUTHENTICATION_ERROR", "x"));
    const second = withToast(<OrderDetailView orderId={ORDER_ID} />);
    expect(await screen.findByText("نشست شما منقضی شده است")).toBeInTheDocument();
    second.unmount();
    orders.getById.mockRejectedValueOnce(new Error("boom"));
    withToast(<OrderDetailView orderId={ORDER_ID} />);
    expect(await screen.findByText("مشکلی پیش آمد")).toBeInTheDocument();
  });

  it("18) لغو با تأیید: فراخوانی API، وضعیت لغوشده و حذف دکمه", async () => {
    const user = userEvent.setup();
    orders.cancel.mockResolvedValue(
      makeOrder({
        status: "CANCELLED", canCancel: false, cancelledAt: "2026-10-11T11:00:00.000Z",
        fulfillment: { state: "CANCELLED", totalParcels: 0, shippedParcels: 0, deliveredParcels: 0 },
      }),
    );
    withToast(<OrderDetailView orderId={ORDER_ID} />);
    await user.click(await screen.findByRole("button", { name: "لغو سفارش" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/به انبار برمی‌گردند/)).toBeInTheDocument();
    expect(orders.cancel).not.toHaveBeenCalled();
    await user.dblClick(within(dialog).getByRole("button", { name: "بله، سفارش لغو شود" }));
    await waitFor(() => expect(orders.cancel).toHaveBeenCalledTimes(1));
    expect(orders.cancel).toHaveBeenCalledWith(ORDER_ID);
    expect(await screen.findByText("لغوشده")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "لغو سفارش" })).not.toBeInTheDocument();
  });

  it("19) انصراف از لغو: هیچ درخواستی ارسال نمی‌شود", async () => {
    const user = userEvent.setup();
    withToast(<OrderDetailView orderId={ORDER_ID} />);
    await user.click(await screen.findByRole("button", { name: "لغو سفارش" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "انصراف" }));
    expect(orders.cancel).not.toHaveBeenCalled();
  });

  it("20) خطای شبکه هنگام لغو: پیام داخل دیالوگ و امکان تلاش مجدد", async () => {
    const user = userEvent.setup();
    orders.cancel.mockRejectedValueOnce(new ApiRequestError(0, "NETWORK_ERROR", "ارتباط با سرور برقرار نشد"));
    withToast(<OrderDetailView orderId={ORDER_ID} />);
    await user.click(await screen.findByRole("button", { name: "لغو سفارش" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "بله، سفارش لغو شود" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("ارتباط با سرور برقرار نشد");
    expect(within(dialog).getByRole("button", { name: "بله، سفارش لغو شود" })).toBeEnabled();
  });

  it("21) رد لغو توسط سرور (۴۰۹ مثلاً همزمان پرداخت شد): پیام سرور و بارگذاری دوبارهٔ وضعیت واقعی", async () => {
    const user = userEvent.setup();
    orders.cancel.mockRejectedValueOnce(
      new ApiRequestError(409, "ORDER_NOT_CANCELLABLE", "وضعیت سفارش همزمان تغییر کرد و دیگر قابل لغو نیست."),
    );
    withToast(<OrderDetailView orderId={ORDER_ID} />);
    await user.click(await screen.findByRole("button", { name: "لغو سفارش" }));
    orders.getById.mockResolvedValue(makeOrder({ status: "PAID", canCancel: false }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "بله، سفارش لغو شود" }));
    expect(await screen.findByText(/همزمان تغییر کرد/)).toBeInTheDocument();
    await waitFor(() => expect(orders.getById).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("button", { name: "لغو سفارش" })).not.toBeInTheDocument());
    expect(screen.getByText("پرداخت‌شده")).toBeInTheDocument();
  });
});
