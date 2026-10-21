// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminCouponDetail, AdminCouponListItem, CouponPreview } from "@vista/shared";
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui";
import { AdminCouponDetailView } from "@/features/admin/coupons/AdminCouponDetailView";
import { AdminCouponCreateView } from "@/features/admin/coupons/AdminCouponCreateView";
import { AdminCouponsView } from "@/features/admin/coupons/AdminCouponsView";
import { EMPTY_COUPON_FORM, toCreatePayload, toUpdatePayload, couponToForm } from "@/features/admin/coupons/couponFormModel";
import { CouponBox } from "@/features/coupons/CouponBox";
import { cartSignature, useCoupon } from "@/features/coupons/useCoupon";
import { describeCheckoutError } from "@/features/checkout/checkoutErrors";
import { adminApi } from "@/lib/api/admin";
import { ApiRequestError } from "@/lib/api/client";
import { couponsApi } from "@/lib/api/coupons";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_API_URL ??= "http://localhost:4000/api";
});

const push = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => "/admin/coupons", useRouter: () => ({ replace: vi.fn(), push }) }));
vi.mock("@/lib/api/coupons", () => ({ couponsApi: { validate: vi.fn() } }));
vi.mock("@/lib/api/admin", () => ({
  adminApi: {
    coupons: vi.fn(),
    coupon: vi.fn(),
    createCoupon: vi.fn(),
    updateCoupon: vi.fn(),
    setCouponStatus: vi.fn(),
    sellers: vi.fn(),
    categories: vi.fn(),
    products: vi.fn(),
  },
}));
const validate = vi.mocked(couponsApi.validate);
const admin = vi.mocked(adminApi);

const preview = (over: Partial<CouponPreview> = {}): CouponPreview => ({
  code: "SUMMER10",
  description: null,
  discountType: "PERCENTAGE",
  discountValue: 10,
  eligibleSubtotal: 1_000_000,
  subtotal: 1_000_000,
  discountAmount: 100_000,
  shippingCost: 0,
  totalAmount: 900_000,
  appliesToAllItems: true,
  ...over,
});
const ruleError = (code: string, message: string) => new ApiRequestError(422, code, message);

function Harness({ items }: { items: { variantId: string; quantity: number }[] }) {
  const coupon = useCoupon(cartSignature(items));
  return (
    <div>
      <CouponBox coupon={coupon} />
      <output data-testid="total">{coupon.applied ? coupon.applied.totalAmount : "none"}</output>
      <output data-testid="busy">{String(coupon.busy)}</output>
    </div>
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});
afterEach(cleanup);

describe("CouponBox / useCoupon", () => {
  it("اعمال موفق: مبلغ از پاسخ سرور نمایش داده و فقط کد ذخیره می‌شود", async () => {
    validate.mockResolvedValue(preview());
    const user = userEvent.setup();
    render(<Harness items={[{ variantId: "v1", quantity: 1 }]} />);
    await user.type(screen.getByRole("textbox", { name: "کد تخفیف" }), "summer10");
    await user.click(screen.getByRole("button", { name: "اعمال" }));
    expect(await screen.findByText("SUMMER10")).toBeInTheDocument();
    expect(screen.getByTestId("total")).toHaveTextContent("900000");
    expect(validate).toHaveBeenCalledWith("summer10", expect.anything());
    expect(window.sessionStorage.getItem("vista:coupon")).toBe("SUMMER10");
  });

  it("کد نامعتبر: پیام سرور زیر فیلد و هیچ کوپنی اعمال نمی‌شود", async () => {
    validate.mockRejectedValue(ruleError("COUPON_INVALID", "کد تخفیف معتبر نیست"));
    const user = userEvent.setup();
    render(<Harness items={[{ variantId: "v1", quantity: 1 }]} />);
    await user.type(screen.getByRole("textbox", { name: "کد تخفیف" }), "BAD");
    await user.click(screen.getByRole("button", { name: "اعمال" }));
    expect(await screen.findByText("کد تخفیف معتبر نیست")).toBeInTheDocument();
    expect(screen.getByTestId("total")).toHaveTextContent("none");
    expect(window.sessionStorage.getItem("vista:coupon")).toBeNull();
  });

  it("کد منقضی: پیام فارسی نشان داده می‌شود", async () => {
    validate.mockRejectedValue(ruleError("COUPON_EXPIRED", "این کد تخفیف منقضی شده است"));
    const user = userEvent.setup();
    render(<Harness items={[{ variantId: "v1", quantity: 1 }]} />);
    await user.type(screen.getByRole("textbox", { name: "کد تخفیف" }), "OLD");
    await user.click(screen.getByRole("button", { name: "اعمال" }));
    expect(await screen.findByText("این کد تخفیف منقضی شده است")).toBeInTheDocument();
  });

  it("حالت بارگذاری: دکمه غیرفعال و دو کلیک سریع فقط یک درخواست می‌فرستد", async () => {
    let resolve!: (value: CouponPreview) => void;
    validate.mockReturnValue(new Promise<CouponPreview>((r) => (resolve = r)));
    const user = userEvent.setup();
    render(<Harness items={[{ variantId: "v1", quantity: 1 }]} />);
    await user.type(screen.getByRole("textbox", { name: "کد تخفیف" }), "SUMMER10");
    const button = screen.getByRole("button", { name: "اعمال" });
    await user.dblClick(button);
    expect(validate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("busy")).toHaveTextContent("true");
    await act(async () => resolve(preview()));
    expect(await screen.findByText("SUMMER10")).toBeInTheDocument();
    expect(screen.getByTestId("busy")).toHaveTextContent("false");
  });

  it("حذف کوپن: به حالت ورودی برمی‌گردد و حافظه پاک می‌شود", async () => {
    validate.mockResolvedValue(preview());
    const user = userEvent.setup();
    render(<Harness items={[{ variantId: "v1", quantity: 1 }]} />);
    await user.type(screen.getByRole("textbox", { name: "کد تخفیف" }), "SUMMER10");
    await user.click(screen.getByRole("button", { name: "اعمال" }));
    await user.click(await screen.findByRole("button", { name: /حذف کد تخفیف/ }));
    expect(screen.getByRole("textbox", { name: "کد تخفیف" })).toBeInTheDocument();
    expect(screen.getByTestId("total")).toHaveTextContent("none");
    expect(window.sessionStorage.getItem("vista:coupon")).toBeNull();
  });

  it("تغییر سبد: بازمحاسبه می‌شود و مبلغ جدید جایگزین می‌شود", async () => {
    validate.mockResolvedValueOnce(preview());
    const user = userEvent.setup();
    function Cart() {
      const [qty, setQty] = useState(1);
      return (
        <>
          <button onClick={() => setQty(2)}>افزایش</button>
          <Harness items={[{ variantId: "v1", quantity: qty }]} />
        </>
      );
    }
    render(<Cart />);
    await user.type(screen.getByRole("textbox", { name: "کد تخفیف" }), "SUMMER10");
    await user.click(screen.getByRole("button", { name: "اعمال" }));
    await screen.findByText("SUMMER10");
    validate.mockResolvedValueOnce(preview({ subtotal: 2_000_000, eligibleSubtotal: 2_000_000, discountAmount: 200_000, totalAmount: 1_800_000 }));
    await user.click(screen.getByRole("button", { name: "افزایش" }));
    await waitFor(() => expect(screen.getByTestId("total")).toHaveTextContent("1800000"));
    expect(validate).toHaveBeenLastCalledWith("SUMMER10", expect.anything());
  });

  it("تغییر سبد و نامعتبر شدن کوپن (حداقل خرید): حذف و اعلان نمایش داده می‌شود", async () => {
    validate.mockResolvedValueOnce(preview());
    const user = userEvent.setup();
    function Cart() {
      const [qty, setQty] = useState(2);
      return (
        <>
          <button onClick={() => setQty(1)}>کاهش</button>
          <Harness items={[{ variantId: "v1", quantity: qty }]} />
        </>
      );
    }
    render(<Cart />);
    await user.type(screen.getByRole("textbox", { name: "کد تخفیف" }), "SUMMER10");
    await user.click(screen.getByRole("button", { name: "اعمال" }));
    await screen.findByText("SUMMER10");
    validate.mockRejectedValueOnce(ruleError("COUPON_MIN_PURCHASE_NOT_MET", "حداقل خرید برای این کد رعایت نشده است"));
    await user.click(screen.getByRole("button", { name: "کاهش" }));
    expect(await screen.findByText(/حداقل خرید برای این کد رعایت نشده است/)).toBeInTheDocument();
    expect(screen.getByTestId("total")).toHaveTextContent("none");
    expect(window.sessionStorage.getItem("vista:coupon")).toBeNull();
  });

  it("کد ذخیره‌شده از صفحهٔ قبل در بارگذاری اول بازمحاسبه می‌شود", async () => {
    window.sessionStorage.setItem("vista:coupon", "SUMMER10");
    validate.mockResolvedValue(preview());
    render(<Harness items={[{ variantId: "v1", quantity: 1 }]} />);
    expect(await screen.findByText("SUMMER10")).toBeInTheDocument();
    expect(screen.getByTestId("total")).toHaveTextContent("900000");
  });

  it("خطای شبکه هنگام بازمحاسبه: کوپن حذف نمی‌شود، فقط هشدار می‌دهد", async () => {
    window.sessionStorage.setItem("vista:coupon", "SUMMER10");
    validate.mockRejectedValue(new ApiRequestError(0, "NETWORK_ERROR", "ارتباط با سرور برقرار نشد"));
    render(<Harness items={[{ variantId: "v1", quantity: 1 }]} />);
    expect(await screen.findByText(/ارتباط با سرور برقرار نشد/)).toBeInTheDocument();
    expect(window.sessionStorage.getItem("vista:coupon")).toBe("SUMMER10");
  });

  it("کوپن جزئی: توضیح مبلغ مشمول نمایش داده می‌شود", async () => {
    validate.mockResolvedValue(preview({ appliesToAllItems: false, eligibleSubtotal: 400_000 }));
    const user = userEvent.setup();
    render(<Harness items={[{ variantId: "v1", quantity: 1 }]} />);
    await user.type(screen.getByRole("textbox", { name: "کد تخفیف" }), "SUMMER10");
    await user.click(screen.getByRole("button", { name: "اعمال" }));
    expect(await screen.findByText(/فقط روی بخشی از کالاهای سبد/)).toBeInTheDocument();
  });
});

describe("خطاهای Checkout", () => {
  it("خطای COUPON_* از نوع coupon است (قابل تلاش مجدد با همان کلید نیست)", () => {
    expect(describeCheckoutError(ruleError("COUPON_USAGE_LIMIT_REACHED", "ظرفیت تمام شد")).kind).toBe("coupon");
  });
});

// ───────── ادمین ─────────

const PAGE = { page: 1, limit: 10, total: 1, totalPages: 1 };
const ID = "00000000-0000-4000-8000-0000000000c1";
const listItem: AdminCouponListItem = {
  id: ID, code: "SUMMER10", description: null, discountType: "PERCENTAGE", discountValue: 10, maxDiscountAmount: null,
  minPurchaseAmount: null, startsAt: null, expiresAt: null, isActive: true, state: "ACTIVE", usageLimit: 100, perUserLimit: 1,
  usedCount: 3, sellerId: null, sellerName: null, productCount: 0, categoryCount: 0, createdAt: "2026-10-10T10:00:00Z",
};
const detail: AdminCouponDetail = {
  ...listItem, updatedAt: "2026-10-10T10:00:00Z", products: [], categories: [],
  stats: { usedCount: 3, releasedCount: 1, remaining: 97, totalDiscountAmount: 300_000 }, history: [],
};
const wrap = (ui: ReactNode) => render(<ToastProvider>{ui}</ToastProvider>);

describe("پنل ادمین کوپن", () => {
  beforeEach(() => {
    admin.sellers.mockResolvedValue({ data: [], pagination: PAGE });
    admin.categories.mockResolvedValue([]);
  });

  it("فهرست: ردیف‌ها، جستجوی کد و فیلتر فعال/غیرفعال", async () => {
    admin.coupons.mockResolvedValue({ data: [listItem], pagination: PAGE });
    const user = userEvent.setup();
    wrap(<AdminCouponsView />);
    expect(await screen.findByText("SUMMER10")).toBeInTheDocument();
    await user.type(screen.getByLabelText("جستجو در کد کوپن"), "summer");
    await user.click(screen.getByRole("button", { name: "جستجو" }));
    await waitFor(() => expect(admin.coupons).toHaveBeenLastCalledWith(expect.objectContaining({ q: "summer", page: 1 })));
    await user.click(screen.getByRole("button", { name: "غیرفعال" }));
    await waitFor(() => expect(admin.coupons).toHaveBeenLastCalledWith(expect.objectContaining({ isActive: false })));
  });

  it("فهرست خالی و خطا", async () => {
    admin.coupons.mockResolvedValueOnce({ data: [], pagination: { ...PAGE, total: 0, totalPages: 0 } });
    wrap(<AdminCouponsView />);
    expect(await screen.findByText("هنوز کوپنی ساخته نشده است")).toBeInTheDocument();
    cleanup();
    admin.coupons.mockRejectedValueOnce(new Error("x"));
    wrap(<AdminCouponsView />);
    expect(await screen.findByText(/دریافت کوپن‌ها انجام نشد/)).toBeInTheDocument();
  });

  it("ساخت: اعتبارسنجی سمت کلاینت، سپس ارسال یک‌باره و هدایت به جزئیات", async () => {
    let resolve!: (v: AdminCouponDetail) => void;
    admin.createCoupon.mockReturnValue(new Promise<AdminCouponDetail>((r) => (resolve = r)));
    const user = userEvent.setup();
    wrap(<AdminCouponCreateView />);
    await user.click(screen.getByRole("button", { name: "ساخت کوپن" }));
    expect(admin.createCoupon).not.toHaveBeenCalled();
    expect(screen.getAllByText(/الزامی|را وارد کنید|باید/).length).toBeGreaterThan(0);

    await user.type(screen.getByLabelText(/کد کوپن/), "new-code");
    await user.type(screen.getByLabelText(/درصد تخفیف/), "۲۰");
    const submit = screen.getByRole("button", { name: "ساخت کوپن" });
    await user.dblClick(submit);
    expect(admin.createCoupon).toHaveBeenCalledTimes(1);
    expect(admin.createCoupon).toHaveBeenCalledWith(expect.objectContaining({ code: "NEW-CODE", discountType: "PERCENTAGE", discountValue: 20 }));
    await act(async () => resolve({ ...detail, id: ID }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/admin/coupons/${ID}`));
  });

  it("ساخت: کد تکراری (۴۰۹) به‌صورت پیام نمایش داده می‌شود", async () => {
    admin.createCoupon.mockRejectedValue(new ApiRequestError(409, "CONFLICT", "این کد قبلاً ثبت شده است", { code: ["این کد قبلاً ثبت شده است"] }));
    const user = userEvent.setup();
    wrap(<AdminCouponCreateView />);
    await user.type(screen.getByLabelText(/کد کوپن/), "DUP10");
    await user.type(screen.getByLabelText(/درصد تخفیف/), "10");
    await user.click(screen.getByRole("button", { name: "ساخت کوپن" }));
    expect((await screen.findAllByText("این کد قبلاً ثبت شده است")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "ساخت کوپن" })).toBeEnabled();
  });

  it("جزئیات: آمار، ویرایش و فعال/غیرفعال‌سازی با تأیید", async () => {
    admin.coupon.mockResolvedValue(detail);
    admin.setCouponStatus.mockResolvedValue({ ...detail, isActive: false, state: "INACTIVE" });
    const user = userEvent.setup();
    wrap(<AdminCouponDetailView couponId={ID} />);
    expect(await screen.findByText("استفادهٔ فعال")).toBeInTheDocument();
    expect(screen.getByText("۹۷")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "غیرفعال‌سازی" }));
    expect(admin.setCouponStatus).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "غیرفعال کن" }));
    await waitFor(() => expect(admin.setCouponStatus).toHaveBeenCalledWith(ID, { isActive: false }));
    expect(await screen.findByText("غیرفعال", { selector: "span" })).toBeInTheDocument();
  });

  it("ویرایش: فقط فیلدهای فرم ارسال می‌شود و کد قابل تغییر نیست", async () => {
    admin.coupon.mockResolvedValue(detail);
    admin.updateCoupon.mockResolvedValue({ ...detail, discountValue: 15, updatedAt: "2026-10-11T10:00:00Z" });
    const user = userEvent.setup();
    wrap(<AdminCouponDetailView couponId={ID} />);
    const code = await screen.findByLabelText(/کد کوپن/);
    expect(code).toBeDisabled();
    const value = screen.getByLabelText(/درصد تخفیف/);
    await user.clear(value);
    await user.type(value, "15");
    await user.click(screen.getByRole("button", { name: "ذخیرهٔ تغییرات" }));
    await waitFor(() => expect(admin.updateCoupon).toHaveBeenCalledTimes(1));
    const [, body] = admin.updateCoupon.mock.calls[0]!;
    expect(body).toMatchObject({ discountValue: 15, usageLimit: 100, perUserLimit: 1 });
    expect(body).not.toHaveProperty("code");
  });
});

describe("couponForm (تبدیل فرم ↔ API)", () => {
  const base = { ...EMPTY_COUPON_FORM, code: "ab1", discountValue: "10" };

  it("ارقام فارسی، نرمال‌سازی کد و حذف مقادیر خالی در ساخت", () => {
    const result = toCreatePayload({ ...base, code: " sum۱۰ ", discountValue: "۱۰", minPurchaseAmount: "۱,۰۰۰,۰۰۰" });
    expect(result).toMatchObject({ ok: true, payload: { code: "SUM10", discountValue: 10, minPurchaseAmount: 1_000_000 } });
    if (result.ok) expect(result.payload).not.toHaveProperty("usageLimit");
  });

  it("درصد بیش از ۱۰۰ و سقف روی کوپن ثابت رد می‌شود", () => {
    expect(toCreatePayload({ ...base, discountValue: "101" })).toMatchObject({ ok: false, errors: { discountValue: expect.any(String) } });
    const fixed = toCreatePayload({ ...base, discountType: "FIXED", discountValue: "5000", maxDiscountAmount: "9000" });
    // سقف برای ثابت هرگز ارسال نمی‌شود، پس معتبر است
    expect(fixed.ok).toBe(true);
    if (fixed.ok) expect(fixed.payload).not.toHaveProperty("maxDiscountAmount");
  });

  it("عدد نامعتبر و تاریخ پایان قبل از شروع", () => {
    expect(toCreatePayload({ ...base, usageLimit: "abc" })).toMatchObject({ ok: false, errors: { usageLimit: expect.any(String) } });
    const bad = toCreatePayload({ ...base, startsAt: "2026-10-20T10:00", expiresAt: "2026-10-19T10:00" });
    expect(bad).toMatchObject({ ok: false, errors: { expiresAt: expect.any(String) } });
  });

  it("ویرایش: خالی‌کردن فیلد = null و رفت‌وبرگشت تاریخ بدون جابه‌جایی", () => {
    const form = couponToForm({ ...detail, startsAt: "2026-10-18T06:30:00.000Z", usageLimit: 100 });
    expect(new Date(form.startsAt).toISOString()).toBe("2026-10-18T06:30:00.000Z");
    const cleared = toUpdatePayload({ ...form, usageLimit: "", perUserLimit: "" });
    expect(cleared).toMatchObject({ ok: true, payload: { usageLimit: null, perUserLimit: null } });
  });
});
