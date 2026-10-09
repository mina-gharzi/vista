// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ProductVariantSummary } from "@vista/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui";
import { VariantBuilder } from "@/features/sellerVariants/VariantBuilder";
import { generateCombinations, suggestSku, validateDrafts } from "@/features/sellerVariants/variantDraft";
import { ApiRequestError } from "@/lib/api/client";
import { sellerVariantsApi } from "@/lib/api/sellerVariants";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL ??= "http://localhost:4000/api";
});

afterEach(cleanup);

vi.mock("@/lib/api/sellerVariants", () => ({
  sellerVariantsApi: { list: vi.fn(), sync: vi.fn(), create: vi.fn(), update: vi.fn(), archive: vi.fn() },
}));

const api = vi.mocked(sellerVariantsApi);
const PRODUCT = { id: "00000000-0000-4000-8000-000000000001", slug: "ts", basePrice: 500_000, status: "DRAFT" as const };

function variant(overrides: Partial<ProductVariantSummary> & { id: string }): ProductVariantSummary {
  return { sku: "TS-BLK-M", size: "M", color: "Black", price: null, stock: 4, isActive: true, ...overrides };
}

const renderBuilder = () =>
  render(
    <ToastProvider>
      <VariantBuilder product={PRODUCT} />
    </ToastProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Variant Builder", () => {
  it("1) تنوع‌های موجود را از Backend می‌خواند و در ردیف‌ها و چیپ‌ها نشان می‌دهد", async () => {
    api.list.mockResolvedValue([
      variant({ id: "v1", sku: "TS-BLK-M", size: "M", color: "Black", price: 600_000 }),
      variant({ id: "v2", sku: "TS-BLK-L", size: "L", color: "Black" }),
      variant({ id: "v3", sku: "OLD", size: "S", color: "Black", isActive: false }),
    ]);
    renderBuilder();

    const list = await screen.findByRole("list", { name: "فهرست تنوع‌ها" });
    expect(within(list).getAllByRole("group")).toHaveLength(2); // آرشیوشده در فهرست نیست
    expect(within(list).getByLabelText("SKU تنوع ۱")).toHaveValue("TS-BLK-M");
    expect(within(list).getByLabelText("قیمت تنوع ۱")).toHaveValue("600000");
    expect(within(list).getByLabelText("قیمت تنوع ۲")).toHaveValue("");
    expect(within(screen.getByRole("list", { name: "رنگ‌ها انتخاب‌شده" })).getByText("Black")).toBeInTheDocument();
    expect(screen.getByText(/۱ تنوع آرشیو شده/)).toBeInTheDocument();
    expect(api.sync).not.toHaveBeenCalled(); // بدون «ذخیره»، چیزی نوشته نمی‌شود
  });

  it("2) ترکیب‌ها (ضرب دکارتی) ساخته می‌شود و دوباره ساختن ردیف تکراری نمی‌سازد", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue([]);
    renderBuilder();
    await screen.findByText(/هنوز تنوعی تعریف نشده/);

    const colorsGroup = screen.getByRole("group", { name: "رنگ‌ها" });
    await user.click(within(colorsGroup).getByRole("button", { name: "مشکی" }));
    await user.click(within(colorsGroup).getByRole("button", { name: "کرم" }));
    const sizesGroup = screen.getByRole("group", { name: "سایزها" });
    for (const size of ["S", "M", "L"]) await user.click(within(sizesGroup).getByRole("button", { name: size }));

    await user.click(screen.getByRole("button", { name: "ساخت ترکیب‌ها" }));
    const list = screen.getByRole("list", { name: "فهرست تنوع‌ها" });
    expect(within(list).getAllByRole("group")).toHaveLength(6);

    await user.click(screen.getByRole("button", { name: "ساخت ترکیب‌ها" }));
    expect(within(list).getAllByRole("group")).toHaveLength(6);
    expect(api.sync).not.toHaveBeenCalled(); // تولید فقط در کلاینت است
  });

  it("3) ردیف تولیدشده قابل ویرایش است (SKU و قیمت) و SKU لاتین پیشنهاد می‌شود", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue([]);
    renderBuilder();
    await screen.findByText(/هنوز تنوعی تعریف نشده/);

    await user.type(screen.getByLabelText("رنگ دلخواه"), "Black{Enter}");
    await user.type(screen.getByLabelText("سایز دلخواه"), "xl{Enter}");
    await user.click(screen.getByRole("button", { name: "ساخت ترکیب‌ها" }));

    const sku = screen.getByLabelText("SKU تنوع ۱");
    expect(sku).toHaveValue("TS-BLA-XL");
    await user.clear(sku);
    await user.type(sku, "my-sku-1");
    await user.type(screen.getByLabelText("قیمت تنوع ۱"), "۷۵۰٬۰۰۰");
    expect(sku).toHaveValue("my-sku-1");
    expect(screen.getByLabelText("قیمت تنوع ۱")).toHaveValue("۷۵۰٬۰۰۰");
  });

  it("4) حذف ردیف، آن را از فهرست برمی‌دارد", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue([variant({ id: "v1" }), variant({ id: "v2", size: "L", sku: "TS-BLK-L" })]);
    renderBuilder();
    const list = await screen.findByRole("list", { name: "فهرست تنوع‌ها" });

    await user.click(screen.getByRole("button", { name: "حذف تنوع ۱: Black / M" }));
    expect(within(list).getAllByRole("group")).toHaveLength(1);
    expect(screen.getByText("تغییرات ذخیره‌نشده دارید.")).toBeInTheDocument();
  });

  it("5) ذخیره: یک درخواست اتمیک با id تنوع موجود، و فهرست از پاسخ سرور تازه می‌شود", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue([variant({ id: "v1", sku: "TS-BLK-M" })]);
    api.sync.mockResolvedValue([
      variant({ id: "v1", sku: "TS-BLK-M", price: 650_000 }),
      variant({ id: "v9", sku: "VST-AB12CD34", size: "L", stock: 0 }),
    ]);
    renderBuilder();
    await screen.findByRole("list", { name: "فهرست تنوع‌ها" });

    await user.type(screen.getByLabelText("قیمت تنوع ۱"), "650000");
    await user.type(screen.getByLabelText("سایز دلخواه"), "L{Enter}");
    await user.click(screen.getByRole("button", { name: "ساخت ترکیب‌ها" }));
    await user.click(screen.getByRole("button", { name: "ذخیره تنوع‌ها" }));

    await waitFor(() => expect(api.sync).toHaveBeenCalledTimes(1));
    const [productId, payload] = api.sync.mock.calls[0] ?? [];
    expect(productId).toBe(PRODUCT.id);
    expect(payload?.variants).toHaveLength(2);
    expect(payload?.variants[0]).toMatchObject({ id: "v1", color: "Black", size: "M", sku: "TS-BLK-M", price: 650_000 });
    expect(payload?.variants[1]).not.toHaveProperty("id");
    expect(payload?.variants[1]).toMatchObject({ color: "Black", size: "L", price: null });
    // sellerId / productId هرگز در Body نیست
    expect(JSON.stringify(payload)).not.toContain("sellerId");

    expect(await screen.findByLabelText("SKU تنوع ۲")).toHaveValue("VST-AB12CD34");
    expect(screen.queryByText("تغییرات ذخیره‌نشده دارید.")).not.toBeInTheDocument();
  });

  it("6) اعتبارسنجی: ترکیب و SKU تکراری و قیمت نامعتبر، ذخیره را متوقف می‌کند", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue([
      variant({ id: "v1", sku: "A-1", size: "M", color: "Black" }),
      variant({ id: "v2", sku: "A-2", size: "L", color: "Black" }),
    ]);
    renderBuilder();
    await screen.findByRole("list", { name: "فهرست تنوع‌ها" });

    await user.clear(screen.getByLabelText("سایز تنوع ۲"));
    await user.type(screen.getByLabelText("سایز تنوع ۲"), " m ");
    await user.clear(screen.getByLabelText("SKU تنوع ۲"));
    await user.type(screen.getByLabelText("SKU تنوع ۲"), "a-1");
    await user.type(screen.getByLabelText("قیمت تنوع ۱"), "-5");
    await user.click(screen.getByRole("button", { name: "ذخیره تنوع‌ها" }));

    expect((await screen.findAllByText("این ترکیب رنگ و سایز تکراری است")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("این SKU تکراری است").length).toBeGreaterThan(0);
    expect(screen.getByText("قیمت باید عدد صحیح مثبت باشد")).toBeInTheDocument();
    expect(screen.getByLabelText("قیمت تنوع ۱")).toHaveAttribute("aria-invalid", "true");
    expect(api.sync).not.toHaveBeenCalled();
  });

  it("7) حالت بارگذاری", () => {
    api.list.mockReturnValue(new Promise(() => {}));
    renderBuilder();
    expect(screen.getByLabelText("در حال بارگذاری تنوع‌ها")).toHaveAttribute("aria-busy", "true");
  });

  it("8) خطای دریافت: ErrorState با تلاش مجدد؛ خطای ذخیره (SKU تکراری سرور) بدون از دست رفتن ویرایش‌ها", async () => {
    const user = userEvent.setup();
    api.list.mockRejectedValueOnce(new ApiRequestError(500, "INTERNAL", "boom"));
    api.list.mockResolvedValue([variant({ id: "v1" })]);
    renderBuilder();

    expect(await screen.findByRole("alert")).toHaveTextContent("دریافت تنوع‌ها انجام نشد.");
    expect(screen.queryByText("boom")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "تلاش مجدد" }));
    await screen.findByRole("list", { name: "فهرست تنوع‌ها" });

    api.sync.mockRejectedValue(
      new ApiRequestError(409, "CONFLICT", "این SKU قبلاً استفاده شده است", {
        sku: ["این SKU قبلاً استفاده شده است"],
      }),
    );
    await user.clear(screen.getByLabelText("SKU تنوع ۱"));
    await user.type(screen.getByLabelText("SKU تنوع ۱"), "taken-1");
    await user.click(screen.getByRole("button", { name: "ذخیره تنوع‌ها" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("این SKU قبلاً استفاده شده است");
    expect(screen.getByLabelText("SKU تنوع ۱")).toHaveValue("taken-1");
    expect(screen.getByRole("button", { name: "ذخیره تنوع‌ها" })).toBeEnabled();
  });

  it("8b) خطای اعتبارسنجی سرور روی ردیف متناظر (variants.N.field) نمایش داده می‌شود", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue([variant({ id: "v1" }), variant({ id: "v2", size: "L", sku: "TS-BLK-L" })]);
    api.sync.mockRejectedValue(
      new ApiRequestError(400, "VALIDATION_ERROR", "داده نامعتبر است", {
        "variants.1.price": ["قیمت باید مثبت باشد"],
      }),
    );
    renderBuilder();
    await screen.findByRole("list", { name: "فهرست تنوع‌ها" });
    await user.type(screen.getByLabelText("قیمت تنوع ۲"), "100");
    await user.click(screen.getByRole("button", { name: "ذخیره تنوع‌ها" }));

    await waitFor(() => expect(screen.getByLabelText("قیمت تنوع ۲")).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByText("قیمت باید مثبت باشد")).toBeInTheDocument();
  });

  it("9) واکنش‌گرایی: ردیف‌ها کارت‌های عمودی روی موبایل و گرید ستونی از md به بعد‌اند", async () => {
    api.list.mockResolvedValue([variant({ id: "v1" })]);
    renderBuilder();
    const row = (await screen.findAllByRole("group")).find((el) => el.getAttribute("aria-label")?.startsWith("تنوع"));
    // موبایل: flex-col (کارت عمودی)، دسکتاپ: گرید ستونی؛ بدون جدول با عرض ثابت
    expect(row).toHaveClass("flex-col", "md:grid");
    expect(document.querySelector("table")).toBeNull();
    // برچسب‌های ستون روی موبایل نمایش داده می‌شوند و سربرگ ستونی فقط از md به بعد
    expect(screen.getAllByText("رنگ", { selector: "span.md\\:hidden" }).length).toBeGreaterThan(0);
    expect(document.querySelector("div.hidden.md\\:grid")).not.toBeNull();
  });
});

describe("variantDraft (منطق خالص)", () => {
  it("generateCombinations ترکیب‌های موجود را رد می‌کند و suggestSku برای فارسی خالی است", () => {
    const first = generateCombinations(["Black", "Cream"], ["S", "M"], [], "ts");
    expect(first).toHaveLength(4);
    const second = generateCombinations(["Black", "Cream", "Beige"], ["S", "M"], first, "ts");
    expect(second.map((d) => `${d.color}/${d.size}`)).toEqual(["Beige/S", "Beige/M"]);
    expect(suggestSku("ts", "مشکی", "M")).toBe("");
    expect(suggestSku("my shirt", "Black", "xl")).toBe("MY-SHIRT-BLA-XL");
  });

  it("validateDrafts ردیف خالی را رد می‌کند", () => {
    const [draft] = generateCombinations(["Black"], ["M"], [], "ts");
    const errors = validateDrafts([{ ...(draft as NonNullable<typeof draft>), color: " ", size: "" }]);
    const row = Object.values(errors)[0];
    expect(row?.color).toBeDefined();
    expect(row?.size).toBeDefined();
  });
});
