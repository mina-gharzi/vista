// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  InventoryItem,
  InventoryMovementEntry,
  InventoryMovementsResult,
  InventoryMutationResult,
  SellerInventoryList,
} from "@vista/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui";
import { SellerInventoryView } from "@/features/sellerInventory/SellerInventoryView";
import { ApiRequestError } from "@/lib/api/client";
import { sellerInventoryApi } from "@/lib/api/sellerInventory";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL ??= "http://localhost:4000/api";
});

afterEach(cleanup);

vi.mock("next/navigation", () => ({ usePathname: () => "/seller/inventory" }));
vi.mock("@/lib/api/sellerInventory", () => ({
  sellerInventoryApi: { list: vi.fn(), movements: vi.fn(), restock: vi.fn(), adjust: vi.fn() },
}));

const api = vi.mocked(sellerInventoryApi);
const V1 = "00000000-0000-4000-8000-000000000001";
const V2 = "00000000-0000-4000-8000-000000000002";

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    variantId: V1,
    productId: "p1",
    productTitle: "کت پشمی",
    productStatus: "PUBLISHED",
    size: "M",
    color: "مشکی",
    sku: "COAT-BLK-M",
    stock: 12,
    status: "IN_STOCK",
    lastMovementAt: "2026-10-01T09:30:00.000Z",
    ...overrides,
  };
}

function makeList(items: InventoryItem[], overrides: Partial<SellerInventoryList> = {}): SellerInventoryList {
  return {
    data: items,
    pagination: { page: 1, limit: 10, total: items.length, totalPages: 1 },
    summary: {
      totalVariants: 3,
      inStockCount: 1,
      lowStockCount: 1,
      outOfStockCount: 1,
      totalUnits: 17,
      lowStockThreshold: 5,
    },
    ...overrides,
  };
}

const LOW = makeItem({ variantId: V2, productTitle: "شلوار کتان", color: "سفید", sku: "PNT-WHT-L", stock: 3, status: "LOW_STOCK", lastMovementAt: null });

function mutation(item: InventoryItem, delta: number): InventoryMutationResult {
  const movement: InventoryMovementEntry = {
    id: "m1",
    type: "RESTOCK",
    quantityDelta: delta,
    stockBefore: item.stock,
    stockAfter: item.stock + delta,
    reason: "تست",
    actorName: "من",
    orderId: null,
    createdAt: "2026-10-02T10:00:00.000Z",
  };
  return { item: { ...item, stock: item.stock + delta }, movement };
}

const renderView = () =>
  render(
    <ToastProvider>
      <SellerInventoryView />
    </ToastProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
  api.list.mockResolvedValue(makeList([makeItem(), LOW]));
});

describe("وضعیت‌های صفحه", () => {
  it("1) در حال بارگذاری: اسکلت نمایش داده می‌شود", () => {
    api.list.mockReturnValue(new Promise(() => undefined));
    renderView();
    expect(screen.getByLabelText("در حال بارگذاری موجودی")).toHaveAttribute("aria-busy", "true");
  });

  it("2) خطا: پیام و «تلاش مجدد» که دوباره درخواست می‌دهد", async () => {
    const user = userEvent.setup();
    api.list.mockRejectedValueOnce(new Error("boom"));
    renderView();
    expect(await screen.findByText("دریافت موجودی انجام نشد.")).toBeInTheDocument();
    expect(screen.queryByText("boom")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "تلاش مجدد" }));
    expect(await screen.findByRole("list", { name: "فهرست موجودی" })).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it("3) خالی: بدون فیلتر دعوت به ساخت تنوع؛ با فیلتر پیام جستجو", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue(makeList([], { summary: { ...makeList([]).summary, totalVariants: 0 } }));
    renderView();
    expect(await screen.findByText("هنوز تنوعی برای مدیریت موجودی ندارید")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "رفتن به محصولات" })).toHaveAttribute("href", "/seller/products");
    await user.click(screen.getByRole("button", { name: "ناموجود" }));
    expect(await screen.findByText("موردی با این فیلتر پیدا نشد")).toBeInTheDocument();
  });

  it("3b) فروشنده تأییدنشده (403): پیام سرور و لینک وضعیت درخواست", async () => {
    api.list.mockRejectedValue(new ApiRequestError(403, "AUTHORIZATION_ERROR", "حساب فروشندگی شما هنوز تأیید نشده است"));
    renderView();
    expect(await screen.findByText("حساب فروشندگی شما هنوز تأیید نشده است")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "وضعیت درخواست فروشندگی" })).toBeInTheDocument();
  });
});

describe("نمایش موجودی", () => {
  it("4) خلاصه، ردیف‌ها، وضعیت فارسی و تاریخ؛ بدون تاریخچه «—»", async () => {
    renderView();
    const summary = await screen.findByRole("region", { name: "خلاصه موجودی" });
    expect(within(summary).getByText("جمع واحد موجود")).toBeInTheDocument();
    expect(within(summary).getByText("۱۷")).toBeInTheDocument();
    expect(within(summary).getByText(/رو به اتمام/)).toBeInTheDocument();

    const list = screen.getByRole("list", { name: "فهرست موجودی" });
    expect(within(list).getByText("کت پشمی")).toBeInTheDocument();
    expect(within(list).getByText("COAT-BLK-M")).toBeInTheDocument();
    expect(within(list).getByText("موجود")).toBeInTheDocument();
    expect(within(list).getByText("رو به اتمام")).toBeInTheDocument();
    expect(within(list).getByText("—")).toBeInTheDocument();
    expect(within(list).getByText("مشکی / M")).toBeInTheDocument();
  });

  it("4b) چیدمان واکنش‌گرا: کارت ستونی در موبایل، گرید در md و برچسب‌های فقط-صفحه‌خوان", async () => {
    renderView();
    const list = await screen.findByRole("list", { name: "فهرست موجودی" });
    const card = within(list).getByText("کت پشمی").closest("article")!;
    expect(card.className).toMatch(/flex-col/);
    expect(card.className).toMatch(/md:grid/);
    expect(within(card).getByText(/موجودی:/)).toHaveClass("md:sr-only");
  });

  it("4c) محصول آرشیوشده: افزایش و اصلاح غیرفعال است", async () => {
    api.list.mockResolvedValue(makeList([makeItem({ productStatus: "ARCHIVED" })]));
    renderView();
    expect(await screen.findByRole("button", { name: /^افزایش موجودی/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^اصلاح موجودی/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^تاریخچه/ })).toBeEnabled();
  });
});

describe("فیلتر و جستجو", () => {
  it("5) فیلتر وضعیت به سرور می‌رود و دکمه فعال aria-pressed دارد", async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByRole("list", { name: "فهرست موجودی" });
    await user.click(screen.getByRole("button", { name: "رو به اتمام" }));
    await waitFor(() =>
      expect(api.list).toHaveBeenLastCalledWith({ page: 1, limit: 10, status: "LOW_STOCK", q: undefined }),
    );
    expect(screen.getByRole("button", { name: "رو به اتمام" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "همه" })).toHaveAttribute("aria-pressed", "false");
  });

  it("5b) جستجو با Enter به سرور می‌رود", async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByRole("list", { name: "فهرست موجودی" });
    await user.type(screen.getByLabelText(/جستجو/), "COAT{Enter}");
    await waitFor(() =>
      expect(api.list).toHaveBeenLastCalledWith({ page: 1, limit: 10, status: undefined, q: "COAT" }),
    );
  });
});

async function openDialog(user: ReturnType<typeof userEvent.setup>, buttonName: RegExp, dialogName: string) {
  await screen.findByRole("list", { name: "فهرست موجودی" });
  await user.click(screen.getAllByRole("button", { name: buttonName })[0]!);
  return screen.getByRole("dialog", { name: dialogName });
}

describe("افزایش موجودی", () => {
  it("6) اعتبارسنجی: تعداد و دلیل الزامی‌اند و درخواستی ارسال نمی‌شود", async () => {
    const user = userEvent.setup();
    renderView();
    const dialog = await openDialog(user, /^افزایش موجودی کت پشمی/, "افزایش موجودی");
    await user.click(within(dialog).getByRole("button", { name: "افزایش موجودی" }));
    expect(within(dialog).getByText("تعداد الزامی است")).toBeInTheDocument();
    expect(within(dialog).getByText("دلیل الزامی است")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/تعداد افزوده‌شده/), "0");
    await user.type(within(dialog).getByLabelText(/دلیل/), "ab");
    await user.click(within(dialog).getByRole("button", { name: "افزایش موجودی" }));
    expect(within(dialog).getByText("تعداد باید حداقل ۱ باشد")).toBeInTheDocument();
    expect(within(dialog).getByText("دلیل باید حداقل ۳ کاراکتر باشد")).toBeInTheDocument();
    expect(api.restock).not.toHaveBeenCalled();
  });

  it("7) موفقیت: ارقام فارسی پذیرفته می‌شود، API درست صدا می‌خورد، فهرست تازه و Toast نمایش داده می‌شود", async () => {
    const user = userEvent.setup();
    api.restock.mockResolvedValue(mutation(makeItem(), 5));
    renderView();
    const dialog = await openDialog(user, /^افزایش موجودی کت پشمی/, "افزایش موجودی");
    await user.type(within(dialog).getByLabelText(/تعداد افزوده‌شده/), "۵");
    await user.type(within(dialog).getByLabelText(/دلیل/), "ورود محموله");
    await user.click(within(dialog).getByRole("button", { name: "افزایش موجودی" }));

    await waitFor(() => expect(api.restock).toHaveBeenCalledWith(V1, { quantity: 5, reason: "ورود محموله" }));
    expect(await screen.findByText("موجودی افزایش یافت")).toBeInTheDocument();
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
  });

  it("8) خطای سرور: پیام فارسی در دیالوگ می‌ماند و فرم باز می‌ماند", async () => {
    const user = userEvent.setup();
    api.restock.mockRejectedValue(new ApiRequestError(409, "CONFLICT_ERROR", "موجودی از سقف مجاز بیشتر می‌شود", { quantity: ["موجودی از سقف مجاز بیشتر می‌شود"] }));
    renderView();
    const dialog = await openDialog(user, /^افزایش موجودی کت پشمی/, "افزایش موجودی");
    await user.type(within(dialog).getByLabelText(/تعداد افزوده‌شده/), "5");
    await user.type(within(dialog).getByLabelText(/دلیل/), "ورود محموله");
    await user.click(within(dialog).getByRole("button", { name: "افزایش موجودی" }));
    expect((await within(dialog).findAllByText("موجودی از سقف مجاز بیشتر می‌شود")).length).toBeGreaterThan(0);
    expect(screen.getByRole("dialog", { name: "افزایش موجودی" })).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledTimes(1);
  });

  it("8b) خطای 500: پیام عمومی نشان داده می‌شود نه متن خام سرور", async () => {
    const user = userEvent.setup();
    api.restock.mockRejectedValue(new ApiRequestError(500, "INTERNAL", "stack trace: at Object.<anonymous>"));
    renderView();
    const dialog = await openDialog(user, /^افزایش موجودی کت پشمی/, "افزایش موجودی");
    await user.type(within(dialog).getByLabelText(/تعداد افزوده‌شده/), "5");
    await user.type(within(dialog).getByLabelText(/دلیل/), "ورود محموله");
    await user.click(within(dialog).getByRole("button", { name: "افزایش موجودی" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("عملیات انجام نشد. لطفاً دوباره تلاش کنید.");
    expect(screen.queryByText(/stack trace/)).not.toBeInTheDocument();
  });

  it("9) ارسال دوباره در حین انجام: فقط یک درخواست و دکمه غیرفعال", async () => {
    const user = userEvent.setup();
    let resolve!: (value: InventoryMutationResult) => void;
    api.restock.mockReturnValue(new Promise((r) => (resolve = r)));
    renderView();
    const dialog = await openDialog(user, /^افزایش موجودی کت پشمی/, "افزایش موجودی");
    await user.type(within(dialog).getByLabelText(/تعداد افزوده‌شده/), "5");
    await user.type(within(dialog).getByLabelText(/دلیل/), "ورود محموله");
    const submit = within(dialog).getByRole("button", { name: "افزایش موجودی" });
    await user.dblClick(submit);
    expect(api.restock).toHaveBeenCalledTimes(1);
    expect(submit).toBeDisabled();
    resolve(mutation(makeItem(), 5));
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
  });
});

describe("اصلاح موجودی", () => {
  it("10) موجودی نهایی: newQuantity به همراه دلیل ارسال می‌شود (صفر مجاز است)", async () => {
    const user = userEvent.setup();
    api.adjust.mockResolvedValue(mutation(makeItem(), -12));
    renderView();
    const dialog = await openDialog(user, /^اصلاح موجودی کت پشمی/, "اصلاح موجودی");
    await user.type(within(dialog).getByLabelText(/موجودی نهایی/), "0");
    await user.type(within(dialog).getByLabelText(/دلیل/), "شمارش انبار");
    await user.click(within(dialog).getByRole("button", { name: "ثبت اصلاح" }));
    await waitFor(() => expect(api.adjust).toHaveBeenCalledWith(V1, { newQuantity: 0, reason: "شمارش انبار" }));
    expect(await screen.findByText("موجودی اصلاح شد")).toBeInTheDocument();
  });

  it("11) حالت Delta: عدد منفی (با علامت ریاضی و ارقام فارسی) پذیرفته می‌شود", async () => {
    const user = userEvent.setup();
    api.adjust.mockResolvedValue(mutation(makeItem(), -2));
    renderView();
    const dialog = await openDialog(user, /^اصلاح موجودی کت پشمی/, "اصلاح موجودی");
    await user.selectOptions(within(dialog).getByLabelText("روش اصلاح"), "delta");
    await user.type(within(dialog).getByLabelText(/مقدار تغییر/), "−۲");
    await user.type(within(dialog).getByLabelText(/دلیل/), "کالای معیوب");
    await user.click(within(dialog).getByRole("button", { name: "ثبت اصلاح" }));
    await waitFor(() => expect(api.adjust).toHaveBeenCalledWith(V1, { delta: -2, reason: "کالای معیوب" }));
  });

  it("12) اعتبارسنجی: مقدار منفی برای موجودی نهایی، متن غیرعددی و دلیل خالی رد می‌شود", async () => {
    const user = userEvent.setup();
    renderView();
    const dialog = await openDialog(user, /^اصلاح موجودی کت پشمی/, "اصلاح موجودی");
    await user.type(within(dialog).getByLabelText(/موجودی نهایی/), "-1");
    await user.click(within(dialog).getByRole("button", { name: "ثبت اصلاح" }));
    expect(within(dialog).getByText("موجودی نمی‌تواند منفی باشد")).toBeInTheDocument();
    expect(within(dialog).getByText("دلیل الزامی است")).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText(/موجودی نهایی/));
    await user.type(within(dialog).getByLabelText(/موجودی نهایی/), "abc");
    await user.click(within(dialog).getByRole("button", { name: "ثبت اصلاح" }));
    expect(api.adjust).not.toHaveBeenCalled();
  });

  it("13) کسر بیش از موجودی (409 سرور): پیام روی فیلد نمایش داده می‌شود", async () => {
    const user = userEvent.setup();
    api.adjust.mockRejectedValue(new ApiRequestError(409, "CONFLICT_ERROR", "موجودی نمی‌تواند منفی شود", { delta: ["موجودی نمی‌تواند منفی شود (موجودی فعلی: 12)"] }));
    renderView();
    const dialog = await openDialog(user, /^اصلاح موجودی کت پشمی/, "اصلاح موجودی");
    await user.selectOptions(within(dialog).getByLabelText("روش اصلاح"), "delta");
    await user.type(within(dialog).getByLabelText(/مقدار تغییر/), "-50");
    await user.type(within(dialog).getByLabelText(/دلیل/), "کسر زیاد");
    await user.click(within(dialog).getByRole("button", { name: "ثبت اصلاح" }));
    expect(await within(dialog).findByText("موجودی نمی‌تواند منفی شود (موجودی فعلی: 12)")).toBeInTheDocument();
  });
});

describe("تاریخچه", () => {
  const history = (items: InventoryMovementEntry[]): InventoryMovementsResult => ({
    variant: makeItem(),
    data: items,
    pagination: { page: 1, limit: 10, total: items.length, totalPages: 1 },
  });

  it("14) حرکت‌ها را با نوع، تغییر، موجودی قبل/بعد، دلیل و ثبت‌کننده نشان می‌دهد", async () => {
    const user = userEvent.setup();
    api.movements.mockResolvedValue(
      history([
        { id: "m1", type: "ADJUSTMENT", quantityDelta: -3, stockBefore: 12, stockAfter: 9, reason: "شمارش انبار", actorName: "مینا", orderId: null, createdAt: "2026-10-02T10:00:00.000Z" },
        { id: "m2", type: "ORDER_PLACED", quantityDelta: -1, stockBefore: 13, stockAfter: 12, reason: null, actorName: null, orderId: "o1", createdAt: "2026-10-01T10:00:00.000Z" },
      ]),
    );
    renderView();
    const dialog = await openDialog(user, /^تاریخچه کت پشمی/, "تاریخچه موجودی");
    const list = await within(dialog).findByRole("list", { name: "حرکت‌های موجودی" });
    expect(api.movements).toHaveBeenCalledWith(V1, { page: 1, limit: 10 });
    expect(within(list).getByText("اصلاح دستی")).toBeInTheDocument();
    expect(within(list).getByText("ثبت سفارش")).toBeInTheDocument();
    expect(within(list).getByText("−۳")).toBeInTheDocument();
    expect(within(list).getByText("شمارش انبار")).toBeInTheDocument();
    expect(within(list).getByText("مینا")).toBeInTheDocument();
    expect(within(list).getAllByText(/ثبت‌کننده/)).toHaveLength(1);
  });

  it("15) خالی و خطا (با تلاش مجدد)", async () => {
    const user = userEvent.setup();
    api.movements.mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce(history([]));
    renderView();
    const dialog = await openDialog(user, /^تاریخچه کت پشمی/, "تاریخچه موجودی");
    expect(await within(dialog).findByText("دریافت تاریخچه انجام نشد.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "تلاش مجدد" }));
    expect(await within(dialog).findByText("هنوز تغییری ثبت نشده است")).toBeInTheDocument();
  });
});
