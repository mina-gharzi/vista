// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PaginatedResponse, ProductStatus, SellerProduct } from "@vista/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui";
import { SellerProductCreateView } from "@/features/sellerProducts/SellerProductCreateView";
import { SellerProductEditView } from "@/features/sellerProducts/SellerProductEditView";
import { SellerProductsView } from "@/features/sellerProducts/SellerProductsView";
import { ApiRequestError } from "@/lib/api/client";
import { categoriesApi } from "@/lib/api/categories";
import { sellerProductsApi } from "@/lib/api/sellerProducts";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL ??= "http://localhost:4000/api";
});

afterEach(cleanup);

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/seller/products",
}));
vi.mock("@/lib/api/sellerProducts", () => ({
  sellerProductsApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    setStatus: vi.fn(),
    archive: vi.fn(),
  },
}));
vi.mock("@/lib/api/categories", () => ({ categoriesApi: { getTree: vi.fn() } }));

const api = vi.mocked(sellerProductsApi);
const tree = vi.mocked(categoriesApi.getTree);

const CATEGORY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PRODUCT_ID = "00000000-0000-4000-8000-000000000001";

function makeProduct(overrides: Partial<SellerProduct> = {}): SellerProduct {
  return {
    id: PRODUCT_ID,
    categoryId: CATEGORY_ID,
    title: "کت پشمی",
    slug: "wool-coat",
    description: "کت پشمی با آستر نرم و دوخت مرغوب",
    basePrice: 2_500_000,
    compareAtPrice: null,
    status: "DRAFT",
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    variants: [{ id: "v1", sku: "S1", size: "M", color: "مشکی", price: null, stock: 3 }],
    images: [],
    ...overrides,
  };
}

function page(items: SellerProduct[]): PaginatedResponse<SellerProduct> {
  return { data: items, pagination: { page: 1, limit: 10, total: items.length, totalPages: 1 } };
}

const withToast = (ui: React.ReactNode) => render(<ToastProvider>{ui}</ToastProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom <dialog>.showModal را ندارد
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
  tree.mockResolvedValue([
    { id: CATEGORY_ID, name: "مردانه", slug: "men", imageUrl: null, children: [] },
  ]);
});

describe("فهرست محصولات", () => {
  it("1) محصولات را با دسته‌بندی، قیمت و وضعیت فارسی نشان می‌دهد", async () => {
    api.list.mockResolvedValue(
      page([makeProduct(), makeProduct({ id: "p2", title: "شلوار", status: "PUBLISHED" })]),
    );
    withToast(<SellerProductsView />);

    const list = await screen.findByRole("list", { name: "فهرست محصولات" });
    expect(within(list).getByText("کت پشمی")).toBeInTheDocument();
    expect(within(list).getByText("پیش‌نویس")).toBeInTheDocument();
    expect(within(list).getByText("منتشر شده")).toBeInTheDocument();
    expect(await within(list).findAllByText("مردانه")).toHaveLength(2);
    expect(within(list).getByRole("link", { name: "ویرایش کت پشمی" })).toHaveAttribute(
      "href",
      `/seller/products/${PRODUCT_ID}/edit`,
    );
    // اقدام‌ها مطابق وضعیت: پیش‌نویس «انتشار» دارد، منتشرشده «لغو انتشار»
    expect(within(list).getAllByRole("button", { name: "انتشار" })).toHaveLength(1);
    expect(within(list).getAllByRole("button", { name: "لغو انتشار" })).toHaveLength(1);
  });

  it("2) حالت خالی با دکمه افزودن محصول", async () => {
    api.list.mockResolvedValue(page([]));
    withToast(<SellerProductsView />);
    expect(await screen.findByText("هنوز محصولی ثبت نکرده‌اید")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /افزودن محصول/ }).length).toBeGreaterThan(0);
  });

  it("3) حالت بارگذاری", () => {
    api.list.mockReturnValue(new Promise(() => {}));
    withToast(<SellerProductsView />);
    expect(screen.getByLabelText("در حال بارگذاری محصولات")).toHaveAttribute("aria-busy", "true");
  });

  it("جستجو و فیلتر وضعیت با پارامترهای سرور", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue(page([makeProduct()]));
    withToast(<SellerProductsView />);
    await screen.findByText("کت پشمی");

    await user.type(screen.getByLabelText("جستجوی محصول"), "کت{Enter}");
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ q: "کت", page: 1 })));
    await user.selectOptions(screen.getByLabelText("وضعیت"), "PUBLISHED" satisfies ProductStatus);
    await waitFor(() =>
      expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: "PUBLISHED" })),
    );
  });
});

describe("ساخت محصول", () => {
  async function fillValid(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText(/نام محصول/), "کت پشمی");
    await user.type(screen.getByLabelText(/توضیحات/), "کت پشمی با آستر نرم و دوخت مرغوب");
    await user.selectOptions(await screen.findByLabelText(/دسته‌بندی محصول/), CATEGORY_ID);
    await user.type(screen.getByLabelText(/^قیمت \(تومان\)/), "۲٬۵۰۰٬۰۰۰");
    await user.type(screen.getByLabelText(/سایز \(تنوع 1\)/), "M");
    await user.type(screen.getByLabelText(/رنگ \(تنوع 1\)/), "مشکی");
  }

  it("4) فرم معتبر ارسال می‌شود (ارقام فارسی تبدیل می‌شود) و به صفحه ویرایش می‌رود", async () => {
    const user = userEvent.setup();
    api.create.mockResolvedValue(makeProduct());
    withToast(<SellerProductCreateView />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "ذخیره به‌عنوان پیش‌نویس" }));

    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(api.create.mock.calls[0]?.[0]).toMatchObject({
      categoryId: CATEGORY_ID,
      title: "کت پشمی",
      basePrice: 2_500_000,
      variants: [{ size: "M", color: "مشکی", stock: 0 }],
    });
    // sellerId/status هرگز ارسال نمی‌شود
    expect(api.create.mock.calls[0]?.[0]).not.toHaveProperty("sellerId");
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/seller/products/${PRODUCT_ID}/edit`));
  });

  it("5) اعتبارسنجی: خطای هر فیلد نمایش داده می‌شود و درخواستی ارسال نمی‌شود", async () => {
    const user = userEvent.setup();
    withToast(<SellerProductCreateView />);
    await user.click(screen.getByRole("button", { name: "ذخیره به‌عنوان پیش‌نویس" }));

    expect(await screen.findByText("عنوان باید حداقل ۳ کاراکتر باشد")).toBeInTheDocument();
    expect(screen.getByLabelText(/نام محصول/)).toHaveAttribute("aria-invalid", "true");
    expect(api.create).not.toHaveBeenCalled();
  });

  it("افزودن تصویر با آدرس نامعتبر خطا می‌دهد و آدرس معتبر اضافه می‌شود", async () => {
    const user = userEvent.setup();
    withToast(<SellerProductCreateView />);
    await user.type(screen.getByLabelText("آدرس تصویر"), "javascript:alert(1)");
    await user.click(screen.getByRole("button", { name: "افزودن تصویر" }));
    expect(screen.getByLabelText("آدرس تصویر")).toHaveAttribute("aria-invalid", "true");

    await user.clear(screen.getByLabelText("آدرس تصویر"));
    await user.type(screen.getByLabelText("آدرس تصویر"), "https://cdn.example.com/a.jpg");
    await user.click(screen.getByRole("button", { name: "افزودن تصویر" }));
    expect(screen.getByRole("list", { name: "تصاویر محصول" })).toBeInTheDocument();
    expect(screen.getByText("تصویر اصلی")).toBeInTheDocument();
  });

  it("10) خطای slug تکراری سرور روی فیلد slug نمایش داده می‌شود", async () => {
    const user = userEvent.setup();
    api.create.mockRejectedValue(
      new ApiRequestError(409, "CONFLICT", "این شناسه محصول قبلاً استفاده شده است", {
        slug: ["این شناسه محصول قبلاً استفاده شده است"],
      }),
    );
    withToast(<SellerProductCreateView />);
    await fillValid(user);
    await user.type(screen.getByLabelText(/شناسه محصول/), "wool-coat");
    await user.click(screen.getByRole("button", { name: "ذخیره به‌عنوان پیش‌نویس" }));

    const slug = screen.getByLabelText(/شناسه محصول/);
    await waitFor(() => expect(slug).toHaveAttribute("aria-invalid", "true"));
    expect(push).not.toHaveBeenCalled();
  });

  it("10b) خطای شبکه پیام کلی نشان می‌دهد و دکمه دوباره فعال می‌شود", async () => {
    const user = userEvent.setup();
    api.create.mockRejectedValue(new ApiRequestError(0, "NETWORK_ERROR", "ارتباط با سرور برقرار نشد."));
    withToast(<SellerProductCreateView />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "ذخیره به‌عنوان پیش‌نویس" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("ارتباط با سرور برقرار نشد.");
    expect(screen.getByRole("button", { name: "ذخیره به‌عنوان پیش‌نویس" })).toBeEnabled();
  });
});

describe("ویرایش و وضعیت", () => {
  it("6) فرم با داده فعلی پر می‌شود و تغییرات ذخیره می‌شود", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(makeProduct());
    api.update.mockResolvedValue(makeProduct({ title: "کت جدید" }));
    withToast(<SellerProductEditView productId={PRODUCT_ID} />);

    const title = await screen.findByLabelText(/نام محصول/);
    expect(title).toHaveValue("کت پشمی");
    await user.clear(title);
    await user.type(title, "کت جدید");
    await user.click(screen.getByRole("button", { name: "ذخیره تغییرات" }));

    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
    expect(api.update).toHaveBeenCalledWith(
      PRODUCT_ID,
      expect.objectContaining({ title: "کت جدید", basePrice: 2_500_000, compareAtPrice: null }),
    );
  });

  it("محصول فروشنده دیگر (404) → پیام «یافت نشد» بدون فرم", async () => {
    api.get.mockRejectedValue(new ApiRequestError(404, "NOT_FOUND", "محصول یافت نشد"));
    withToast(<SellerProductEditView productId={PRODUCT_ID} />);
    expect(await screen.findByText("محصول یافت نشد")).toBeInTheDocument();
    expect(screen.queryByLabelText(/نام محصول/)).not.toBeInTheDocument();
  });

  it("7) انتشار: setStatus با PUBLISHED و جایگزینی دکمه با «لغو انتشار»", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(makeProduct());
    api.setStatus.mockResolvedValue(makeProduct({ status: "PUBLISHED" }));
    withToast(<SellerProductEditView productId={PRODUCT_ID} />);

    await user.click(await screen.findByRole("button", { name: "انتشار" }));
    await waitFor(() => expect(api.setStatus).toHaveBeenCalledWith(PRODUCT_ID, "PUBLISHED"));
    expect(await screen.findByRole("button", { name: "لغو انتشار" })).toBeInTheDocument();
  });

  it("8) لغو انتشار: setStatus با DRAFT", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(makeProduct({ status: "PUBLISHED" }));
    api.setStatus.mockResolvedValue(makeProduct({ status: "DRAFT" }));
    withToast(<SellerProductEditView productId={PRODUCT_ID} />);

    await user.click(await screen.findByRole("button", { name: "لغو انتشار" }));
    await waitFor(() => expect(api.setStatus).toHaveBeenCalledWith(PRODUCT_ID, "DRAFT"));
    expect(await screen.findByRole("button", { name: "انتشار" })).toBeInTheDocument();
  });

  it("9) آرشیو فقط پس از تأیید انجام می‌شود و فرم ویرایش بسته می‌شود", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(makeProduct());
    api.archive.mockResolvedValue(makeProduct({ status: "ARCHIVED" }));
    withToast(<SellerProductEditView productId={PRODUCT_ID} />);

    await user.click(await screen.findByRole("button", { name: "آرشیو" }));
    expect(api.archive).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "تأیید آرشیو" }));

    await waitFor(() => expect(api.archive).toHaveBeenCalledWith(PRODUCT_ID));
    expect(await screen.findByText("محصول آرشیو شده و قابل ویرایش نیست.")).toBeInTheDocument();
    expect(screen.queryByLabelText(/نام محصول/)).not.toBeInTheDocument();
  });

  it("10c) انتشار ردشده توسط سرور: دلایل نمایش داده می‌شود و وضعیت عوض نمی‌شود", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(makeProduct());
    api.setStatus.mockRejectedValue(
      new ApiRequestError(409, "CONFLICT", "محصول هنوز آماده انتشار نیست", {
        status: ["حداقل یک تنوع (سایز/رنگ) لازم است"],
      }),
    );
    withToast(<SellerProductEditView productId={PRODUCT_ID} />);

    await user.click(await screen.findByRole("button", { name: "انتشار" }));
    expect(await screen.findByText("محصول هنوز آماده انتشار نیست")).toBeInTheDocument();
    expect(screen.getByText("حداقل یک تنوع (سایز/رنگ) لازم است")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "انتشار" })).toBeInTheDocument();
  });

  it("10d) خطای دریافت فهرست: ErrorState با تلاش مجدد", async () => {
    const user = userEvent.setup();
    api.list.mockRejectedValueOnce(new ApiRequestError(500, "INTERNAL", "boom"));
    api.list.mockResolvedValue(page([makeProduct()]));
    withToast(<SellerProductsView />);

    expect(await screen.findByRole("alert")).toHaveTextContent("دریافت محصولات انجام نشد.");
    expect(screen.queryByText("boom")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "تلاش مجدد" }));
    expect(await screen.findByText("کت پشمی")).toBeInTheDocument();
  });
});
