// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PublicProductVariant } from "@vista/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui";
import { ProductPurchasePanel } from "@/features/catalog/ProductPurchasePanel";
import { combinationState, displayedPrice, resolveVariant } from "@/features/catalog/variantSelection";
import { cartApi } from "@/lib/api/cart";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL ??= "http://localhost:4000/api";
});

afterEach(cleanup);

let authStatus: "authenticated" | "unauthenticated" = "authenticated";
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => ({ status: authStatus }) }));
vi.mock("@/features/wishlist/WishlistButton", () => ({ WishlistButton: () => null }));
vi.mock("@/lib/api/cart", () => ({ cartApi: { addItem: vi.fn() } }));

const addItem = vi.mocked(cartApi.addItem);

const v = (id: string, color: string, size: string, stock: number, price: number | null = null): PublicProductVariant => ({
  id,
  color,
  size,
  stock,
  price,
});

const VARIANTS = [
  v("v-blk-s", "Black", "S", 3),
  v("v-blk-m", "Black", "M", 5, 650_000),
  v("v-crm-s", "Cream", "S", 0),
  // Cream/M عمداً وجود ندارد
];

const renderPanel = (variants = VARIANTS, compareAtPrice: number | null = null) =>
  render(
    <ToastProvider>
      <ProductPurchasePanel
        productId="p1"
        description="توضیحات محصول"
        basePrice={500_000}
        compareAtPrice={compareAtPrice}
        variants={variants}
      />
    </ToastProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  authStatus = "authenticated";
});

describe("صفحه محصول مشتری — انتخاب تنوع", () => {
  it("1) محصول بدون تنوع: ناموجود و بدون امکان افزودن به سبد", () => {
    renderPanel([]);
    expect(screen.getByText("این کالا در حال حاضر ناموجود است.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "افزودن به سبد خرید" })).toBeDisabled();
  });

  it("2) محصول با تنوع: چیپ رنگ و سایز، و هنوز چیزی انتخاب نشده → دکمه غیرفعال و قیمت «از»", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "رنگ Black" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "سایز M" })).toBeInTheDocument();
    expect(screen.getByText("رنگ و سایز را انتخاب کنید.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "افزودن به سبد خرید" })).toBeDisabled();
    expect(screen.getByText("از")).toBeInTheDocument();
    expect(screen.getByTestId("price")).toHaveTextContent("۵۰۰٬۰۰۰");
  });

  it("3) انتخاب رنگ، چیپ را فعال (aria-pressed) و عنوان را به‌روز می‌کند", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: "رنگ Black" }));
    expect(screen.getByRole("button", { name: "رنگ Black" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("رنگ: Black")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "افزودن به سبد خرید" })).toBeDisabled(); // سایز هنوز مانده
  });

  it("4) انتخاب سایز: چیپ سایز فعال می‌شود و موجودی کم هشدار می‌دهد", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: "رنگ Black" }));
    await user.click(screen.getByRole("button", { name: "سایز S" }));
    expect(screen.getByRole("button", { name: "سایز S" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("فقط 3 عدد باقی مانده است.")).toBeInTheDocument();
  });

  it("5) ترکیب انتخابی به تنوع درست resolve می‌شود", () => {
    expect(resolveVariant(VARIANTS, "black", " m ")?.id).toBe("v-blk-m");
    expect(resolveVariant(VARIANTS, "Cream", "M")).toBeNull();
    expect(combinationState(VARIANTS, "Cream", "S")).toBe("out_of_stock");
    expect(combinationState(VARIANTS, "Cream", "M")).toBe("missing");
    expect(combinationState(VARIANTS, "", "M")).toBe("unselected");
  });

  it("6) قیمت، قیمت مؤثر تنوع انتخابی است؛ تنوع بدون قیمت اختصاصی از قیمت پایه می‌آید", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: "رنگ Black" }));
    await user.click(screen.getByRole("button", { name: "سایز M" }));
    expect(screen.getByTestId("price")).toHaveTextContent("۶۵۰٬۰۰۰");
    expect(screen.queryByText("از")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "سایز S" }));
    expect(screen.getByTestId("price")).toHaveTextContent("۵۰۰٬۰۰۰");

    expect(displayedPrice(VARIANTS, null, 500_000)).toEqual({ amount: 500_000, isFrom: true });
  });

  it("6b) تخفیف فقط برای قیمت پایه نشان داده می‌شود، نه برای تنوعِ با قیمت اختصاصی", async () => {
    const user = userEvent.setup();
    renderPanel(VARIANTS, 800_000);
    await user.click(screen.getByRole("button", { name: "رنگ Black" }));
    await user.click(screen.getByRole("button", { name: "سایز S" }));
    expect(screen.getByText(/تخفیف/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "سایز M" }));
    expect(screen.queryByText(/تخفیف/)).not.toBeInTheDocument();
  });

  it("7) ترکیب ناموجود یا ناموجودیِ تنوع، صریح اعلام می‌شود و افزودن به سبد ممکن نیست", async () => {
    const user = userEvent.setup();
    renderPanel();
    // چیپ‌های بدون موجودی هنوز قابل انتخاب‌اند ولی «ناموجود» برچسب می‌خورند
    await user.click(screen.getByRole("button", { name: "رنگ Cream (ناموجود)" }));
    await user.click(screen.getByRole("button", { name: "سایز M (ناموجود)" }));
    expect(screen.getByText("این ترکیب رنگ و سایز وجود ندارد.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "افزودن به سبد خرید" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "سایز S (ناموجود)" }));
    expect(screen.getByText("این ترکیب در حال حاضر ناموجود است.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "افزودن به سبد خرید" })).toBeDisabled();
    expect(addItem).not.toHaveBeenCalled();
  });

  it("8) افزودن به سبد، variantId تنوع انتخاب‌شده را با تعداد ارسال می‌کند", async () => {
    const user = userEvent.setup();
    addItem.mockResolvedValue({ items: [], itemCount: 0, subtotal: 0 });
    renderPanel();
    await user.click(screen.getByRole("button", { name: "رنگ Black" }));
    await user.click(screen.getByRole("button", { name: "سایز M" }));
    await user.selectOptions(screen.getByLabelText("تعداد"), "2");
    await user.click(screen.getByRole("button", { name: "افزودن به سبد خرید" }));

    await waitFor(() => expect(addItem).toHaveBeenCalledTimes(1));
    expect(addItem).toHaveBeenCalledWith({ variantId: "v-blk-m", quantity: 2 });
  });

  it("محصول تک‌رنگ/تک‌سایز: انتخاب خودکار و فقط یک گروه چیپ", () => {
    renderPanel([v("only", "مشکی", "تک‌سایز", 4)]);
    expect(screen.queryByRole("button", { name: /^رنگ/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "افزودن به سبد خرید" })).toBeEnabled();
  });

  it("کاربر مهمان: لینک ورود به‌جای فرم افزودن به سبد", () => {
    authStatus = "unauthenticated";
    renderPanel();
    expect(screen.getByRole("link", { name: "وارد شوید" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("button", { name: "افزودن به سبد خرید" })).not.toBeInTheDocument();
  });

  it("خطای سرور هنگام افزودن، پیام را نشان می‌دهد و دکمه دوباره فعال است", async () => {
    const user = userEvent.setup();
    const { ApiRequestError } = await import("@/lib/api/client");
    addItem.mockRejectedValue(new ApiRequestError(404, "NOT_FOUND", "این کالا در دسترس نیست"));
    renderPanel();
    await user.click(screen.getByRole("button", { name: "رنگ Black" }));
    await user.click(screen.getByRole("button", { name: "سایز M" }));
    await user.click(screen.getByRole("button", { name: "افزودن به سبد خرید" }));
    expect(await screen.findByText("این کالا در دسترس نیست")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "افزودن به سبد خرید" })).toBeEnabled();
  });
});
