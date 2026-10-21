// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PublicProductVariant } from "@vista/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui";
import { ProductGallery } from "@/features/catalog/ProductGallery";
import { ProductPurchasePanel } from "@/features/catalog/ProductPurchasePanel";
import { cartApi } from "@/lib/api/cart";
import { ApiRequestError } from "@/lib/api/client";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL ??= "http://localhost:4000/api";
});
afterEach(cleanup);

vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => ({ status: "authenticated" }) }));
vi.mock("@/features/wishlist/WishlistButton", () => ({ WishlistButton: () => null }));
vi.mock("@/lib/api/cart", () => ({ cartApi: { addItem: vi.fn() } }));
const addItem = vi.mocked(cartApi.addItem);

const VARIANTS: PublicProductVariant[] = [
  { id: "v1", color: "Black", size: "M", stock: 5, price: null },
  { id: "v2", color: "Black", size: "L", stock: 5, price: null },
];

const open = async () => {
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <ProductPurchasePanel productId="p" description="d" basePrice={1000} compareAtPrice={null} variants={VARIANTS} />
    </ToastProvider>,
  );
  await user.click(screen.getByRole("button", { name: "سایز M" }));
  return user;
};

beforeEach(() => vi.clearAllMocks());

describe("افزودن به سبد: بازیابی و جلوگیری از ارسال تکراری", () => {
  it("دو کلیک پشت‌سرهم فقط یک درخواست می‌سازد", async () => {
    let finish!: () => void;
    addItem.mockReturnValue(new Promise((r) => (finish = () => r({ items: [], itemCount: 0, subtotal: 0 }))));
    const user = await open();
    const button = screen.getByRole("button", { name: "افزودن به سبد خرید" });
    await user.dblClick(button);
    expect(addItem).toHaveBeenCalledTimes(1);
    finish();
    await waitFor(() => expect(screen.getByRole("button", { name: "افزودن به سبد خرید" })).toBeEnabled());
  });

  it("کالای دیگر قابل خرید نیست (۴۰۴): پیام + راه بازیابی؛ تنوع جایگزین نمی‌شود", async () => {
    addItem.mockRejectedValue(new ApiRequestError(404, "NOT_FOUND", "این کالا در دسترس نیست"));
    const user = await open();
    await user.click(screen.getByRole("button", { name: "افزودن به سبد خرید" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("این کالا در دسترس نیست");
    expect(screen.getByRole("button", { name: "به‌روزرسانی صفحه و موجودی" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "سایز M" })).toHaveAttribute("aria-pressed", "true");
    expect(addItem).toHaveBeenCalledWith({ variantId: "v1", quantity: 1 });
  });

  it("موجودی ناکافی (۴۰۹) پیام سرور را نشان می‌دهد", async () => {
    addItem.mockRejectedValue(new ApiRequestError(409, "CONFLICT", "موجودی کافی نیست — حداکثر ۲ عدد موجود است"));
    const user = await open();
    await user.click(screen.getByRole("button", { name: "افزودن به سبد خرید" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("موجودی کافی نیست");
  });

  it("نشست منقضی (۴۰۱): لینک ورود دوباره", async () => {
    addItem.mockRejectedValue(new ApiRequestError(401, "UNAUTHORIZED", "x"));
    const user = await open();
    await user.click(screen.getByRole("button", { name: "افزودن به سبد خرید" }));
    expect(await screen.findByRole("link", { name: "ورود دوباره" })).toHaveAttribute("href", "/login");
  });

  it("خطای قبلی با تلاش بعدی پاک می‌شود", async () => {
    addItem.mockRejectedValueOnce(new ApiRequestError(409, "CONFLICT", "موجودی کافی نیست")).mockResolvedValue({ items: [], itemCount: 0, subtotal: 0 });
    const user = await open();
    await user.click(screen.getByRole("button", { name: "افزودن به سبد خرید" }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "افزودن به سبد خرید" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});

describe("گالری تصویر", () => {
  it("انتخاب بندانگشتی تصویر اصلی را عوض می‌کند", async () => {
    render(<ProductGallery title="کت" images={[{ url: "https://i/1.jpg", altText: "نمای اول" }, { url: "https://i/2.jpg", altText: "نمای دوم" }]} />);
    expect(screen.getByAltText("نمای اول")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "نمایش تصویر 2" }));
    expect(screen.getByAltText("نمای دوم")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "نمایش تصویر 2" })).toHaveAttribute("aria-pressed", "true");
  });
  it("بدون تصویر: متن جایگزین", () => {
    render(<ProductGallery title="کت" images={[]} />);
    expect(screen.getByText("بدون تصویر")).toBeInTheDocument();
  });
});
