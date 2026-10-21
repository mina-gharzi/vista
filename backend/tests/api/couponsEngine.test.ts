import { describe, expect, it } from "vitest";
import { COUPON_ERROR_CODES, isValidCouponCode, normalizeCouponCode } from "@vista/shared";
import {
  allocateProportionally,
  categoryChainOf,
  computeDiscountAmount,
  evaluateCoupon,
  type CouponRules,
  type PricedLine,
} from "../../src/modules/coupons/coupons.engine";
import { computeCharges } from "../../src/modules/orders/orders.pricing";

const NOW = new Date("2026-10-18T08:00:00.000Z");

const coupon = (over: Partial<CouponRules> = {}): CouponRules => ({
  id: "c1",
  code: "TEST10",
  description: null,
  discountType: "FIXED",
  discountValue: 100_000,
  maxDiscountAmount: null,
  minPurchaseAmount: null,
  startsAt: null,
  expiresAt: null,
  isActive: true,
  usageLimit: null,
  perUserLimit: null,
  usedCount: 0,
  sellerId: null,
  productIds: [],
  categoryIds: [],
  ...over,
});

let seq = 0;
const line = (over: Partial<PricedLine> = {}): PricedLine => {
  seq += 1;
  return {
    variantId: `v${String(seq).padStart(3, "0")}`,
    productId: `p${seq}`,
    sellerId: "sA",
    categoryChain: ["cat1"],
    unitPrice: 500_000,
    quantity: 2,
    ...over,
  };
};

const run = (c: CouponRules, lines: PricedLine[], extra: { userRedemptions?: number } = {}) =>
  evaluateCoupon({ coupon: c, lines, userRedemptions: extra.userRedemptions ?? 0, now: NOW });

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return undefined;
}

describe("نرمال‌سازی کد کوپن", () => {
  it("حروف بزرگ، ارقام فارسی/عربی → لاتین، حذف فاصله و نیم‌فاصله و نویسه‌های نامرئی", () => {
    expect(normalizeCouponCode("summer10")).toBe("SUMMER10");
    expect(normalizeCouponCode(" Summer۱۰ ")).toBe("SUMMER10");
    expect(normalizeCouponCode("SUM‌MER١٠")).toBe("SUMMER10");
    expect(normalizeCouponCode("ＳＵＭＭＥＲ-10")).toBe("SUMMER-10");
  });

  it("فرمت: فقط A-Z 0-9 - _ و طول ۳ تا ۳۲", () => {
    expect(isValidCouponCode("AB")).toBe(false);
    expect(isValidCouponCode("A".repeat(33))).toBe(false);
    expect(isValidCouponCode("OFF_20-A")).toBe(true);
    expect(isValidCouponCode("تخفیف")).toBe(false);
    expect(isValidCouponCode("A B C")).toBe(false);
    expect(isValidCouponCode("A%B")).toBe(false);
  });
});

describe("محاسبهٔ مبلغ تخفیف", () => {
  it("ثابت: مبلغ تعریف‌شده؛ هرگز بیشتر از مجموع مشمول", () => {
    expect(computeDiscountAmount(coupon({ discountValue: 100_000 }), 1_000_000)).toBe(100_000);
    expect(computeDiscountAmount(coupon({ discountValue: 5_000_000 }), 1_000_000)).toBe(1_000_000);
  });

  it("درصدی: floor عدد صحیح (بدون Float) و سقف حداکثر تخفیف", () => {
    const pct = coupon({ discountType: "PERCENTAGE", discountValue: 15 });
    expect(computeDiscountAmount(pct, 999_999)).toBe(149_999); // 149999.85 → 149999
    expect(computeDiscountAmount({ ...pct, discountValue: 50, maxDiscountAmount: 200_000 }, 1_000_000)).toBe(200_000);
    expect(computeDiscountAmount({ ...pct, discountValue: 100 }, 777_777)).toBe(777_777);
  });

  it("مبالغ بزرگ بدون خطای ممیز شناور (۲ میلیارد × ۹۹٪)", () => {
    const pct = coupon({ discountType: "PERCENTAGE", discountValue: 99 });
    expect(computeDiscountAmount(pct, 2_000_000_000)).toBe(1_980_000_000);
    expect(computeDiscountAmount({ ...pct, discountValue: 33 }, 1_999_999_999)).toBe(659_999_999); // floor(659999999.67)
  });
});

describe("تقسیم تخفیف بین ردیف‌ها (بیشترین باقی‌مانده)", () => {
  it("جمع سهم‌ها دقیقاً برابر کل؛ هر سهم ≤ وزن؛ مستقل از ترتیب ورودی", () => {
    const weights = [
      { key: "b", weight: 3 },
      { key: "a", weight: 3 },
      { key: "c", weight: 3 },
    ];
    const forward = allocateProportionally(100, weights);
    const reversed = allocateProportionally(100, [...weights].reverse());
    expect([...forward.values()].reduce((s, v) => s + v, 0)).toBe(100);
    expect(forward.get("a")).toBe(34); // تساوی باقی‌مانده → کلید صعودی
    expect(forward.get("b")).toBe(33);
    expect(forward.get("c")).toBe(33);
    expect(Object.fromEntries(reversed)).toEqual(Object.fromEntries(forward));
  });

  it("با مبالغ بزرگ (BigInt) مجموع دقیق است و هیچ سهمی از وزنش بیشتر نیست", () => {
    const weights = [
      { key: "x", weight: 1_500_000_000 },
      { key: "y", weight: 499_999_999 },
      { key: "z", weight: 1 },
    ];
    const result = allocateProportionally(1_999_999_999, weights);
    expect([...result.values()].reduce((s, v) => s + v, 0)).toBe(1_999_999_999);
    for (const w of weights) expect(result.get(w.key)!).toBeLessThanOrEqual(w.weight);
  });

  it("تخفیف ۱ تومانی روی چند ردیف: فقط یک ردیف می‌گیرد", () => {
    const result = allocateProportionally(1, [
      { key: "a", weight: 10 },
      { key: "b", weight: 10 },
    ]);
    expect([...result.values()].sort()).toEqual([0, 1]);
  });
});

describe("مشمولیت (فروشنده / محصول / دسته)", () => {
  it("بدون محدودیت: همهٔ ردیف‌ها مشمول‌اند", () => {
    const result = run(coupon(), [line(), line({ sellerId: "sB" })]);
    expect(result.eligibleSubtotal).toBe(2_000_000);
    expect(result.appliesToAllItems).toBe(true);
  });

  it("کوپن فروشنده فقط کالای همان فروشنده را تخفیف می‌دهد؛ سهم فروشندهٔ دیگر صفر/غایب است", () => {
    const a = line({ sellerId: "sA", unitPrice: 600_000, quantity: 1 });
    const b = line({ sellerId: "sB", unitPrice: 400_000, quantity: 1 });
    const result = run(coupon({ sellerId: "sA", discountValue: 50_000 }), [a, b]);
    expect(result.eligibleSubtotal).toBe(600_000);
    expect(result.subtotal).toBe(1_000_000);
    expect(result.appliesToAllItems).toBe(false);
    expect(result.lineDiscounts.get(a.variantId)).toBe(50_000);
    expect(result.lineDiscounts.has(b.variantId)).toBe(false);
    expect(result.sellerDiscounts.get("sA")).toBe(50_000);
    expect(result.sellerDiscounts.has("sB")).toBe(false);
  });

  it("محدودیت محصول: فقط محصول‌های فهرست‌شده", () => {
    const a = line({ productId: "pa" });
    const b = line({ productId: "pb" });
    const result = run(coupon({ productIds: ["pa"] }), [a, b]);
    expect(result.eligibleSubtotal).toBe(1_000_000);
    expect([...result.lineDiscounts.keys()]).toEqual([a.variantId]);
  });

  it("دستهٔ والد، زیردسته‌ها را هم شامل می‌شود (زنجیره)", () => {
    const parents = new Map<string, string | null>([
      ["women", null],
      ["coats", "women"],
      ["men", null],
    ]);
    expect(categoryChainOf("coats", parents)).toEqual(["coats", "women"]);
    const coat = line({ categoryChain: categoryChainOf("coats", parents) });
    const men = line({ categoryChain: categoryChainOf("men", parents) });
    const result = run(coupon({ categoryIds: ["women"] }), [coat, men]);
    expect([...result.lineDiscounts.keys()]).toEqual([coat.variantId]);
  });

  it("زنجیرهٔ دستهٔ دارای حلقه (داده خراب) بی‌نهایت نمی‌شود", () => {
    const parents = new Map<string, string | null>([
      ["a", "b"],
      ["b", "a"],
    ]);
    expect(categoryChainOf("a", parents)).toEqual(["a", "b"]);
  });

  it("محصول و دسته «اجتماع» هستند؛ فروشنده همیشه محدودکنندهٔ اضافه است", () => {
    const l1 = line({ productId: "p1", categoryChain: ["c1"], sellerId: "sA" });
    const l2 = line({ productId: "p2", categoryChain: ["c2"], sellerId: "sA" });
    const l3 = line({ productId: "p3", categoryChain: ["c3"], sellerId: "sA" });
    const l4 = line({ productId: "p1", categoryChain: ["c1"], sellerId: "sB" });
    const result = run(coupon({ productIds: ["p1"], categoryIds: ["c2"], sellerId: "sA" }), [l1, l2, l3, l4]);
    expect(new Set(result.lineDiscounts.keys())).toEqual(new Set([l1.variantId, l2.variantId]));
  });

  it("هیچ ردیف مشمولی نیست → NOT_APPLICABLE", () => {
    expect(codeOf(() => run(coupon({ sellerId: "zzz" }), [line()]))).toBe(COUPON_ERROR_CODES.NOT_APPLICABLE);
  });
});

describe("حداقل خرید، سقف‌ها و زمان", () => {
  it("حداقل خرید روی «مجموع مشمول» است، نه کل سبد", () => {
    const small = line({ sellerId: "sA", unitPrice: 400_000, quantity: 1 });
    const big = line({ sellerId: "sB", unitPrice: 5_000_000, quantity: 1 });
    const c = coupon({ sellerId: "sA", minPurchaseAmount: 500_000 });
    let caught: { code?: string; details?: Record<string, string[]> } = {};
    try {
      run(c, [small, big]);
    } catch (error) {
      caught = error as typeof caught;
    }
    expect(caught.code).toBe(COUPON_ERROR_CODES.MIN_PURCHASE_NOT_MET);
    expect(caught.details).toEqual({ minPurchaseAmount: ["500000"], eligibleSubtotal: ["400000"] });
    expect(run({ ...c, minPurchaseAmount: 400_000 }, [small, big]).discountAmount).toBe(100_000);
  });

  it("غیرفعال → INVALID (مثل ناموجود)؛ منقضی (دقیقاً در لحظهٔ انقضا هم)؛ هنوز شروع نشده", () => {
    expect(codeOf(() => run(coupon({ isActive: false }), [line()]))).toBe(COUPON_ERROR_CODES.INVALID);
    expect(codeOf(() => run(coupon({ expiresAt: NOW }), [line()]))).toBe(COUPON_ERROR_CODES.EXPIRED);
    expect(codeOf(() => run(coupon({ expiresAt: new Date(NOW.getTime() - 1) }), [line()]))).toBe(COUPON_ERROR_CODES.EXPIRED);
    expect(codeOf(() => run(coupon({ expiresAt: new Date(NOW.getTime() + 1) }), [line()]))).toBeUndefined();
    expect(codeOf(() => run(coupon({ startsAt: new Date(NOW.getTime() + 1) }), [line()]))).toBe(COUPON_ERROR_CODES.NOT_STARTED);
    expect(codeOf(() => run(coupon({ startsAt: NOW }), [line()]))).toBeUndefined();
  });

  it("سقف کل و سقف هر مشتری", () => {
    expect(codeOf(() => run(coupon({ usageLimit: 5, usedCount: 5 }), [line()]))).toBe(COUPON_ERROR_CODES.USAGE_LIMIT_REACHED);
    expect(codeOf(() => run(coupon({ usageLimit: 5, usedCount: 4 }), [line()]))).toBeUndefined();
    expect(codeOf(() => run(coupon({ perUserLimit: 2 }), [line()], { userRedemptions: 2 }))).toBe(COUPON_ERROR_CODES.USER_LIMIT_REACHED);
    expect(codeOf(() => run(coupon({ perUserLimit: 2 }), [line()], { userRedemptions: 1 }))).toBeUndefined();
  });

  it("سبد خالی و تخفیف صفر (۵٪ از ۱۰ تومان)", () => {
    expect(codeOf(() => run(coupon(), []))).toBe(COUPON_ERROR_CODES.EMPTY_CART);
    const tiny = line({ unitPrice: 10, quantity: 1 });
    expect(codeOf(() => run(coupon({ discountType: "PERCENTAGE", discountValue: 5 }), [tiny]))).toBe(
      COUPON_ERROR_CODES.NOT_APPLICABLE,
    );
  });
});

describe("جمع نهایی", () => {
  it("تخفیف هرگز بیشتر از subtotal نیست و جمع منفی نمی‌شود", () => {
    expect(computeCharges(1_000_000, 300_000)).toEqual({ shippingCost: 0, discountAmount: 300_000, totalAmount: 700_000 });
    expect(computeCharges(1_000_000, 9_000_000).totalAmount).toBe(0);
    expect(computeCharges(1_000_000, -5).discountAmount).toBe(0);
  });

  it("سناریوی کامل: ۲ فروشنده، ۱۰٪ با سقف، جمع سهم‌ها = تخفیف سفارش", () => {
    const a = line({ sellerId: "sA", unitPrice: 333_333, quantity: 3 }); // 999_999
    const b = line({ sellerId: "sB", unitPrice: 777_777, quantity: 1 }); // 777_777
    const c = line({ sellerId: "sB", unitPrice: 1_234_567, quantity: 1 });
    const result = run(coupon({ discountType: "PERCENTAGE", discountValue: 10, maxDiscountAmount: 250_000 }), [a, b, c]);
    expect(result.subtotal).toBe(999_999 + 777_777 + 1_234_567);
    expect(result.discountAmount).toBe(250_000);
    const lineSum = [...result.lineDiscounts.values()].reduce((s, v) => s + v, 0);
    const sellerSum = [...result.sellerDiscounts.values()].reduce((s, v) => s + v, 0);
    expect(lineSum).toBe(250_000);
    expect(sellerSum).toBe(250_000);
  });
});
