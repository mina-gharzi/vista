// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  AdminCategory,
  AdminDashboard,
  AdminOrderDetail,
  AdminProductDetail,
  AdminProductListItem,
  AdminSellerDetail,
  AdminSellerListItem,
} from "@vista/shared";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui";
import { AdminCategoriesView } from "@/features/admin/AdminCategoriesView";
import { AdminDashboardView } from "@/features/admin/AdminDashboardView";
import { AdminOrderDetailView } from "@/features/admin/AdminOrderDetailView";
import { AdminOrdersView } from "@/features/admin/AdminOrdersView";
import { AdminProductDetailView } from "@/features/admin/AdminProductDetailView";
import { AdminProductsView } from "@/features/admin/AdminProductsView";
import { AdminSellerDetailView } from "@/features/admin/AdminSellerDetailView";
import { AdminSellersView } from "@/features/admin/AdminSellersView";
import { AdminShell } from "@/features/admin/AdminShell";
import { RequireAdmin } from "@/features/admin/RequireAdmin";
import { adminApi } from "@/lib/api/admin";
import { ApiRequestError } from "@/lib/api/client";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL ??= "http://localhost:4000/api";
});

afterEach(cleanup);

let role: "ADMIN" | "CUSTOMER" | "SELLER" = "ADMIN";
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => ({ status: "authenticated", user: { role } }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin/dashboard", useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/api/admin", () => ({
  adminApi: {
    dashboard: vi.fn(),
    sellers: vi.fn(),
    seller: vi.fn(),
    changeSellerStatus: vi.fn(),
    products: vi.fn(),
    product: vi.fn(),
    changeProductStatus: vi.fn(),
    categories: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    orders: vi.fn(),
    order: vi.fn(),
  },
}));
const api = vi.mocked(adminApi);

const ID = "00000000-0000-4000-8000-0000000000a1";
const PAGE = { page: 1, limit: 10, total: 1, totalPages: 1 };
const wrap = (ui: ReactNode) => render(<ToastProvider>{ui}</ToastProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  role = "ADMIN";
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

const err = (status: number, message: string, details?: Record<string, string[]>) =>
  new ApiRequestError(status, status === 409 ? "CONFLICT" : "ERR", message, details);

// ───────── fixtures ─────────
const dashboard = (over: Partial<AdminDashboard> = {}): AdminDashboard => ({
  customers: 12,
  sellers: { PENDING: 3, APPROVED: 5, SUSPENDED: 1, REJECTED: 0 },
  products: { DRAFT: 2, PUBLISHED: 40, ARCHIVED: 1 },
  orders: { PENDING: 1, PAID: 7, CANCELLED: 0, REFUNDED: 0 },
  pendingSellerApplications: 3,
  recentOrders: [{ id: ID, orderNumber: 1001, status: "PAID", totalAmount: 500000, createdAt: "2026-10-10T10:00:00Z" }],
  recentSellers: [{ id: ID, storeName: "بوتیک آرا", status: "PENDING", createdAt: "2026-10-09T10:00:00Z" }],
  ...over,
});
const sellerItem = (over: Partial<AdminSellerListItem> = {}): AdminSellerListItem => ({
  id: ID, storeName: "بوتیک آرا", storeSlug: "ara", status: "PENDING", ownerName: "سارا", ownerEmail: "sara@example.com", productCount: 3, createdAt: "2026-10-09T10:00:00Z", ...over,
});
const sellerDetail = (over: Partial<AdminSellerDetail> = {}): AdminSellerDetail => ({
  id: ID, storeName: "بوتیک آرا", storeSlug: "ara", description: null, status: "PENDING", statusReason: null, statusChangedAt: null,
  createdAt: "2026-10-09T10:00:00Z", owner: { name: "سارا", email: "sara@example.com", phone: null, registeredAt: "2026-10-01T10:00:00Z" },
  products: { DRAFT: 1, PUBLISHED: 2, ARCHIVED: 0 }, sellerOrderCount: 4, allowedTransitions: ["APPROVED", "REJECTED"], history: [], ...over,
});
const productItem = (over: Partial<AdminProductListItem> = {}): AdminProductListItem => ({
  id: ID, title: "کت پشمی", slug: "coat", status: "PUBLISHED", basePrice: 1_000_000, categoryName: "کت", sellerId: ID, sellerName: "بوتیک آرا",
  sellerStatus: "APPROVED", sellerBlocked: false, totalStock: 8, createdAt: "2026-10-09T10:00:00Z", ...over,
});
const productDetail = (over: Partial<AdminProductDetail> = {}): AdminProductDetail => ({
  ...productItem(), description: "توضیح محصول", compareAtPrice: null, images: [], allowedTransitions: ["DRAFT", "ARCHIVED"], history: [],
  variants: [{ id: "v1", size: "M", color: "مشکی", sku: "SKU-1", price: null, stock: 8, isActive: true }], ...over,
});
const category = (over: Partial<AdminCategory> = {}): AdminCategory => ({
  id: ID, name: "پوشاک", slug: "clothes", imageUrl: null, isActive: true, sortOrder: 0, parentId: null, parentName: null, productCount: 2, childCount: 0, ...over,
});
const orderDetail = (): AdminOrderDetail => ({
  id: ID, orderNumber: 1001, status: "PAID", subtotal: 500000, shippingCost: 0, discountAmount: 0, couponCode: null, totalAmount: 500000,
  createdAt: "2026-10-10T10:00:00Z", paidAt: "2026-10-10T10:05:00Z", cancelledAt: null,
  customer: { name: "مینا مشتری", email: "mina@example.com", phone: "09120000000" },
  shippingAddress: { fullName: "مینا", phone: "09120000000", province: "تهران", city: "تهران", postalCode: "1234567890", addressLine: "خیابان اول" },
  fulfillment: { state: "PENDING", totalParcels: 1, shippedParcels: 0, deliveredParcels: 0 },
  sellerOrders: [{
    id: "so1", sellerId: ID, sellerName: "بوتیک آرا", status: "PENDING", subtotal: 500000, discountAmount: 0, trackingCode: null, shippedAt: null, deliveredAt: null,
    items: [{ id: "i1", productTitle: "کت پشمی", sku: "SKU-1", size: "M", color: "مشکی", quantity: 2, unitPrice: 250000, lineTotal: 500000 }], history: [],
  }],
});

describe("دسترسی و قالب", () => {
  it("غیرادمین پیام «دسترسی ندارید» می‌بیند و محتوا رندر نمی‌شود", () => {
    role = "CUSTOMER";
    render(<RequireAdmin><p>محتوای محرمانه</p></RequireAdmin>);
    expect(screen.getByText("دسترسی به پنل مدیریت ندارید")).toBeInTheDocument();
    expect(screen.queryByText("محتوای محرمانه")).not.toBeInTheDocument();
    expect(api.dashboard).not.toHaveBeenCalled();
  });

  it("ادمین محتوا را می‌بیند", () => {
    render(<RequireAdmin><p>محتوا</p></RequireAdmin>);
    expect(screen.getByText("محتوا")).toBeInTheDocument();
  });

  it("منوی ناوبری هر ۵ بخش را دارد و صفحهٔ جاری مشخص است", () => {
    render(<AdminShell><p>x</p></AdminShell>);
    const nav = screen.getByRole("navigation", { name: "ناوبری مدیریت" });
    for (const label of ["داشبورد", "فروشندگان", "محصولات", "دسته‌بندی‌ها", "سفارش‌ها"]) {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(within(nav).getByRole("link", { name: "داشبورد" })).toHaveAttribute("aria-current", "page");
  });
});

describe("داشبورد", () => {
  it("حالت بارگذاری، سپس شمارش‌ها", async () => {
    let resolve!: (d: AdminDashboard) => void;
    api.dashboard.mockReturnValue(new Promise((r) => (resolve = r)));
    wrap(<AdminDashboardView />);
    expect(screen.getByLabelText("در حال بارگذاری داشبورد")).toHaveAttribute("aria-busy", "true");
    resolve(dashboard());
    expect(await screen.findByText("مشتریان")).toBeInTheDocument();
    const sellers = screen.getByRole("region", { name: "فروشندگان بر اساس وضعیت" });
    expect(within(sellers).getByText("در انتظار بررسی").nextSibling).toHaveTextContent("۳");
    expect(screen.getByRole("link", { name: "#۱٬۰۰۱" })).toHaveAttribute("href", `/admin/orders/${ID}`);
  });

  it("خطا → تلاش مجدد", async () => {
    api.dashboard.mockRejectedValueOnce(new Error("x")).mockResolvedValue(dashboard());
    wrap(<AdminDashboardView />);
    await userEvent.click(await screen.findByRole("button", { name: "تلاش مجدد" }));
    expect(await screen.findByText("مشتریان")).toBeInTheDocument();
    expect(api.dashboard).toHaveBeenCalledTimes(2);
  });

  it("۴۰۳ پیام عدم دسترسی نشان می‌دهد", async () => {
    api.dashboard.mockRejectedValue(err(403, "شما دسترسی لازم را ندارید"));
    wrap(<AdminDashboardView />);
    expect(await screen.findByText("شما دسترسی لازم را ندارید")).toBeInTheDocument();
  });

  it("فهرست‌های خالی پیام مناسب دارند و درآمد نمایش داده نمی‌شود", async () => {
    api.dashboard.mockResolvedValue(dashboard({ recentOrders: [], recentSellers: [], pendingSellerApplications: 0 }));
    wrap(<AdminDashboardView />);
    expect(await screen.findByText("هنوز سفارشی ثبت نشده است.")).toBeInTheDocument();
    expect(screen.getByText("هنوز فروشنده‌ای ثبت‌نام نکرده است.")).toBeInTheDocument();
    expect(screen.queryByText("درآمد")).not.toBeInTheDocument();
  });
});

describe("فروشندگان", () => {
  it("فهرست، فیلتر وضعیت و جستجو", async () => {
    api.sellers.mockResolvedValue({ data: [sellerItem()], pagination: PAGE });
    wrap(<AdminSellersView />);
    expect(await screen.findByText("بوتیک آرا")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "تعلیق‌شده" }));
    await waitFor(() => expect(api.sellers).toHaveBeenLastCalledWith(expect.objectContaining({ status: "SUSPENDED", page: 1 })));
    await userEvent.type(screen.getByLabelText(/جستجو/), "ara");
    await userEvent.click(screen.getByRole("button", { name: "جستجو" }));
    await waitFor(() => expect(api.sellers).toHaveBeenLastCalledWith(expect.objectContaining({ q: "ara" })));
  });

  it("نتیجهٔ خالی با فیلتر → پیام مناسب", async () => {
    api.sellers.mockResolvedValue({ data: [], pagination: { ...PAGE, total: 0, totalPages: 0 } });
    wrap(<AdminSellersView initialStatus="REJECTED" />);
    expect(await screen.findByText("فروشنده‌ای با این فیلتر پیدا نشد")).toBeInTheDocument();
  });
});

describe("جزئیات فروشنده", () => {
  it("تأیید: فراخوانی API بدون دلیل و به‌روزشدن وضعیت", async () => {
    api.seller.mockResolvedValue(sellerDetail());
    api.changeSellerStatus.mockResolvedValue(sellerDetail({ status: "APPROVED", allowedTransitions: ["SUSPENDED"] }));
    wrap(<AdminSellerDetailView sellerId={ID} />);
    await userEvent.click(await screen.findByRole("button", { name: "تأیید / فعال‌سازی" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByLabelText(/دلیل/)).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "تأیید و ثبت" }));
    await waitFor(() => expect(api.changeSellerStatus).toHaveBeenCalledWith(ID, { status: "APPROVED" }));
    expect(await screen.findByRole("button", { name: "تعلیق فروشنده" })).toBeInTheDocument();
  });

  it("رد بدون دلیل ارسال نمی‌شود؛ با دلیل ارسال می‌شود", async () => {
    api.seller.mockResolvedValue(sellerDetail());
    api.changeSellerStatus.mockResolvedValue(sellerDetail({ status: "REJECTED", allowedTransitions: [] }));
    wrap(<AdminSellerDetailView sellerId={ID} />);
    await userEvent.click(await screen.findByRole("button", { name: "رد درخواست" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "تأیید و ثبت" }));
    expect(api.changeSellerStatus).not.toHaveBeenCalled();
    expect(within(dialog).getByText(/.+/, { selector: "[id$='-error'], [role='alert']" })).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/دلیل/), "مدارک ناقص است");
    await userEvent.click(within(dialog).getByRole("button", { name: "تأیید و ثبت" }));
    await waitFor(() => expect(api.changeSellerStatus).toHaveBeenCalledWith(ID, { status: "REJECTED", reason: "مدارک ناقص است" }));
  });

  it("ارسال دوباره در حین درخواست یک فراخوانی بیشتر نمی‌سازد", async () => {
    api.seller.mockResolvedValue(sellerDetail());
    let finish!: (d: AdminSellerDetail) => void;
    api.changeSellerStatus.mockReturnValue(new Promise((r) => (finish = r)));
    wrap(<AdminSellerDetailView sellerId={ID} />);
    await userEvent.click(await screen.findByRole("button", { name: "تأیید / فعال‌سازی" }));
    const confirm = within(await screen.findByRole("dialog")).getByRole("button", { name: "تأیید و ثبت" });
    await userEvent.dblClick(confirm);
    expect(api.changeSellerStatus).toHaveBeenCalledTimes(1);
    finish(sellerDetail({ status: "APPROVED", allowedTransitions: [] }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("۴۰۹ (داده کهنه): پیام نمایش و دادهٔ فروشنده دوباره خوانده می‌شود", async () => {
    api.seller.mockResolvedValue(sellerDetail());
    api.changeSellerStatus.mockRejectedValue(err(409, "وضعیت فروشنده در این فاصله تغییر کرده است"));
    wrap(<AdminSellerDetailView sellerId={ID} />);
    await userEvent.click(await screen.findByRole("button", { name: "تأیید / فعال‌سازی" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "تأیید و ثبت" }));
    expect(await screen.findByText("وضعیت فروشنده در این فاصله تغییر کرده است")).toBeInTheDocument();
    await waitFor(() => expect(api.seller).toHaveBeenCalledTimes(2));
  });

  it("وضعیت پایانی (ردشده) هیچ دکمهٔ اقدامی ندارد؛ دلیل نمایش داده می‌شود", async () => {
    api.seller.mockResolvedValue(sellerDetail({ status: "REJECTED", statusReason: "مدارک ناقص", allowedTransitions: [] }));
    wrap(<AdminSellerDetailView sellerId={ID} />);
    expect(await screen.findByText(/مدارک ناقص/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /تأیید|رد درخواست|تعلیق/ })).not.toBeInTheDocument();
  });

  it("۴۰۴ → فروشنده یافت نشد", async () => {
    api.seller.mockRejectedValue(err(404, "یافت نشد"));
    wrap(<AdminSellerDetailView sellerId={ID} />);
    expect(await screen.findByText("فروشنده یافت نشد")).toBeInTheDocument();
  });
});

describe("محصولات", () => {
  it("فهرست با نشان فروشندهٔ غیرفعال و فیلتر وضعیت", async () => {
    api.categories.mockResolvedValue([category()]);
    api.products.mockResolvedValue({ data: [productItem({ sellerBlocked: true, sellerStatus: "SUSPENDED" })], pagination: PAGE });
    wrap(<AdminProductsView />);
    expect(await screen.findByText("فروشندهٔ غیرفعال", { selector: "span" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "پیش‌نویس" }));
    await waitFor(() => expect(api.products).toHaveBeenLastCalledWith(expect.objectContaining({ status: "DRAFT" })));
    await userEvent.selectOptions(screen.getByLabelText("دسته‌بندی"), ID);
    await waitFor(() => expect(api.products).toHaveBeenLastCalledWith(expect.objectContaining({ categoryId: ID })));
  });

  it("لغو انتشار نیازمند دلیل است و دلیل ارسال می‌شود", async () => {
    api.product.mockResolvedValue(productDetail());
    api.changeProductStatus.mockResolvedValue(productDetail({ status: "DRAFT", allowedTransitions: ["ARCHIVED"] }));
    wrap(<AdminProductDetailView productId={ID} />);
    await userEvent.click(await screen.findByRole("button", { name: "لغو انتشار" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "تأیید و ثبت" }));
    expect(api.changeProductStatus).not.toHaveBeenCalled();
    await userEvent.type(within(dialog).getByLabelText(/دلیل/), "تصویر نامناسب");
    await userEvent.click(within(dialog).getByRole("button", { name: "تأیید و ثبت" }));
    await waitFor(() => expect(api.changeProductStatus).toHaveBeenCalledWith(ID, { status: "DRAFT", reason: "تصویر نامناسب" }));
  });

  it("جزئیات تنوع‌ها را نشان می‌دهد؛ بایگانی‌شده بدون اقدام", async () => {
    api.product.mockResolvedValue(productDetail({ status: "ARCHIVED", allowedTransitions: [] }));
    wrap(<AdminProductDetailView productId={ID} />);
    expect(await screen.findByText("SKU-1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /لغو انتشار|بایگانی/ })).not.toBeInTheDocument();
  });
});

describe("دسته‌بندی‌ها", () => {
  beforeEach(() => api.categories.mockResolvedValue([category()]));

  it("slug نامعتبر ارسال نمی‌شود؛ مقدار معتبر با Payload درست ارسال می‌شود", async () => {
    api.createCategory.mockResolvedValue(category({ id: "new" }));
    wrap(<AdminCategoriesView />);
    await userEvent.click(await screen.findByRole("button", { name: "دسته‌بندی جدید" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/^نام/), "کفش");
    await userEvent.type(within(dialog).getByLabelText(/slug/), "Bad Slug!");
    await userEvent.click(within(dialog).getByRole("button", { name: "ذخیره" }));
    expect(api.createCategory).not.toHaveBeenCalled();
    await userEvent.clear(within(dialog).getByLabelText(/slug/));
    await userEvent.type(within(dialog).getByLabelText(/slug/), "shoes");
    await userEvent.click(within(dialog).getByRole("button", { name: "ذخیره" }));
    await waitFor(() =>
      expect(api.createCategory).toHaveBeenCalledWith(expect.objectContaining({ name: "کفش", slug: "shoes", parentId: null, isActive: true })),
    );
  });

  it("slug تکراری (۴۰۹) زیر همان فیلد نمایش داده می‌شود", async () => {
    api.createCategory.mockRejectedValue(err(409, "این شناسه (slug) قبلاً استفاده شده است", { slug: ["این شناسه (slug) قبلاً استفاده شده است"] }));
    wrap(<AdminCategoriesView />);
    await userEvent.click(await screen.findByRole("button", { name: "دسته‌بندی جدید" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/^نام/), "پوشاک");
    await userEvent.type(within(dialog).getByLabelText(/slug/), "clothes");
    await userEvent.click(within(dialog).getByRole("button", { name: "ذخیره" }));
    expect((await within(dialog).findAllByText("این شناسه (slug) قبلاً استفاده شده است")).length).toBeGreaterThan(0);
  });

  it("ویرایش فقط فیلدهای تغییرکرده را می‌فرستد", async () => {
    api.updateCategory.mockResolvedValue(category({ name: "لباس" }));
    wrap(<AdminCategoriesView />);
    await userEvent.click(await screen.findByRole("button", { name: "ویرایش پوشاک" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.clear(within(dialog).getByLabelText(/^نام/));
    await userEvent.type(within(dialog).getByLabelText(/^نام/), "لباس");
    await userEvent.click(within(dialog).getByRole("button", { name: "ذخیره" }));
    await waitFor(() => expect(api.updateCategory).toHaveBeenCalledWith(ID, { name: "لباس" }));
  });

  it("حذف با تأیید؛ خطای ۴۰۹ سرور در دیالوگ نمایش داده می‌شود", async () => {
    api.deleteCategory.mockRejectedValue(err(409, "این دسته محصول دارد و حذف نمی‌شود"));
    wrap(<AdminCategoriesView />);
    await userEvent.click(await screen.findByRole("button", { name: "حذف پوشاک" }));
    const dialog = await screen.findByRole("dialog");
    expect(api.deleteCategory).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "حذف" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("این دسته محصول دارد و حذف نمی‌شود");
    expect(api.deleteCategory).toHaveBeenCalledTimes(1);
  });

  it("غیرفعال‌سازی پس از تأیید isActive=false می‌فرستد", async () => {
    api.updateCategory.mockResolvedValue(category({ isActive: false }));
    wrap(<AdminCategoriesView />);
    await userEvent.click(await screen.findByRole("button", { name: "غیرفعال‌سازی پوشاک" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "غیرفعال‌سازی" }));
    await waitFor(() => expect(api.updateCategory).toHaveBeenCalledWith(ID, { isActive: false }));
  });
});

describe("سفارش‌ها", () => {
  it("فهرست، فیلتر وضعیت و اعتبارسنجی بازهٔ تاریخ", async () => {
    api.orders.mockResolvedValue({
      data: [{ id: ID, orderNumber: 1001, status: "PAID", totalAmount: 500000, customerName: "مینا", sellerCount: 1, fulfillment: { state: "PENDING", totalParcels: 1, shippedParcels: 0, deliveredParcels: 0 }, createdAt: "2026-10-10T10:00:00Z" }],
      pagination: PAGE,
    });
    wrap(<AdminOrdersView />);
    expect(await screen.findByText("مینا", { exact: false })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "لغوشده" }));
    await waitFor(() => expect(api.orders).toHaveBeenLastCalledWith(expect.objectContaining({ status: "CANCELLED" })));

    const callsBefore = api.orders.mock.calls.length;
    await userEvent.type(screen.getByLabelText("از تاریخ"), "2026-10-12");
    await userEvent.type(screen.getByLabelText("تا تاریخ"), "2026-10-10");
    await userEvent.click(screen.getByRole("button", { name: "اعمال فیلتر" }));
    expect(await screen.findByText("تاریخ پایان نباید قبل از شروع باشد")).toBeInTheDocument();
    expect(api.orders).toHaveBeenCalledTimes(callsBefore);
  });

  it("جزئیات: مشتری، اقلام و بدون هیچ کنترل نوشتنی", async () => {
    api.order.mockResolvedValue(orderDetail());
    wrap(<AdminOrderDetailView orderId={ID} />);
    expect(await screen.findByText("مینا مشتری")).toBeInTheDocument();
    expect(screen.getByText(/SKU-1/)).toBeInTheDocument();
    expect(screen.getByText(/پرداخت: پرداخت‌شده/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
