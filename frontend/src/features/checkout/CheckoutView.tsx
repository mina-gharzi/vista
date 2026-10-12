"use client";

import type { AddressSummary, CartSummary } from "@vista/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Card, ErrorState, Skeleton } from "@/components/ui";
import { addressesApi } from "@/lib/api/addresses";
import { cartApi } from "@/lib/api/cart";
import { ordersApi } from "@/lib/api/orders";
import { cn } from "@/lib/utils/cn";
import { formatNumber, formatPrice } from "@/lib/utils/format";
import { newUuid } from "@/lib/utils/uuid";
import { AddressForm } from "./AddressForm";
import { describeCheckoutError, type DescribedCheckoutError } from "./checkoutErrors";

type LoadState = "loading" | "error" | "ready";

const STEPS = ["سبد خرید", "آدرس تحویل", "تأیید و ثبت"] as const;

function CheckoutSteps({ current }: { current: 0 | 1 | 2 }) {
  return (
    <ol aria-label="مراحل ثبت سفارش" className="mb-6 flex items-center gap-3 text-sm">
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex items-center gap-2",
              active ? "font-medium text-bordeaux" : done ? "text-ink" : "text-ink-faint",
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border text-xs",
                active || done ? "border-bordeaux" : "border-border",
                done && "bg-bordeaux text-ivory",
              )}
              aria-hidden="true"
            >
              {formatNumber(index + 1)}
            </span>
            <span>{label}</span>
            <span className="sr-only">{done ? "(انجام شد)" : active ? "(مرحلهٔ فعلی)" : ""}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function CheckoutView() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>("loading");
  const [cart, setCart] = useState<CartSummary | null>(null);
  const [addresses, setAddresses] = useState<AddressSummary[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [problem, setProblem] = useState<DescribedCheckoutError | null>(null);
  const [priceNotice, setPriceNotice] = useState<{ previous: number; current: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /**
   * کلید یکتای «این تلاش» برای Idempotency سمت سرور. تا وقتی کاربر ورودی را عوض نکرده
   * (مثلاً بعد از قطعی شبکه یا خطای ۵xx) همان کلید دوباره ارسال می‌شود تا هرگز سفارش تکراری نسازد؛
   * با تغییر آدرس یا سبد، کلید جدید ساخته می‌شود.
   */
  const checkoutKey = useRef<string>(newUuid());
  // Ref علاوه بر state: دو کلیک پشت‌سرهم قبل از Render بعدی هم فقط یک درخواست می‌سازد
  const inFlight = useRef(false);

  const renewKey = () => {
    checkoutKey.current = newUuid();
  };

  useEffect(() => {
    Promise.all([cartApi.get(), addressesApi.list()])
      .then(([cartData, addressList]) => {
        setCart(cartData);
        setAddresses(addressList);
        setSelectedAddressId(addressList.find((a) => a.isDefault)?.id ?? addressList[0]?.id ?? null);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  const refreshCart = useCallback(async () => {
    try {
      setCart(await cartApi.get());
    } catch {
      // نمایش قبلی می‌ماند؛ خطای اصلی همچنان به کاربر نشان داده شده است
    }
  }, []);

  const handleAddressCreated = (created: { id: string }) => {
    addressesApi.list().then((list) => {
      setAddresses(list);
      setSelectedAddressId(created.id);
      setShowAddForm(false);
      renewKey();
    });
  };

  const selectAddress = (id: string) => {
    if (id === selectedAddressId) return;
    setSelectedAddressId(id);
    setProblem(null);
    renewKey();
  };

  const handleSubmit = async () => {
    if (!selectedAddressId || !cart || inFlight.current) return;
    inFlight.current = true;
    setProblem(null);
    setSubmitting(true);
    const seenTotal = cart.subtotal;
    try {
      const order = await ordersApi.checkout({
        addressId: selectedAddressId,
        checkoutKey: checkoutKey.current,
        // مبلغی که کاربر دیده؛ فقط برای تأیید (سرور خودش از دیتابیس محاسبه می‌کند)
        expectedTotal: seenTotal,
      });
      setPriceNotice(null);
      router.replace(`/orders/${order.id}?placed=1`);
      router.refresh();
      // عمداً submitting را false نمی‌کنیم: تا لحظهٔ Navigation دکمه قفل می‌ماند
    } catch (error) {
      const described = describeCheckoutError(error);
      if (!described.keepKey) renewKey();
      if (described.kind === "price_changed" || described.kind === "unavailable") {
        await refreshCart();
        if (described.kind === "price_changed" && described.actualTotal !== null) {
          setPriceNotice({ previous: seenTotal, current: described.actualTotal });
        }
      }
      if (described.kind === "empty_cart") await refreshCart();
      setProblem(described);
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  if (state === "loading") {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (state === "error" || !cart) {
    return <ErrorState onRetry={() => window.location.reload()} />;
  }

  if (cart.items.length === 0) {
    return (
      <ErrorState
        title="سبد خرید شما خالی است"
        description="ابتدا محصولی به سبد اضافه کنید."
        action={
          <Link href="/products" className="text-bordeaux underline">
            مشاهده محصولات
          </Link>
        }
      />
    );
  }

  const unavailableInfo = problem?.kind === "unavailable" ? problem.unavailable : {};
  const hasUnavailable = cart.items.some((item) => !item.isAvailable);
  const step: 0 | 1 | 2 = selectedAddressId ? 2 : 1;

  return (
    <div>
      <CheckoutSteps current={step} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          <Card padding="lg" className="flex flex-col gap-4">
            <h2 className="type-h3">آدرس تحویل</h2>

            {addresses.length === 0 && !showAddForm && (
              <p className="text-sm text-ink-muted">هنوز آدرسی ثبت نکرده‌اید.</p>
            )}

            {addresses.length > 0 && (
              <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">انتخاب آدرس تحویل</legend>
                {addresses.map((address) => (
                  <label
                    key={address.id}
                    className="flex cursor-pointer items-start gap-3 rounded border border-border p-3 focus-within:ring-2 focus-within:ring-bordeaux has-[:checked]:border-bordeaux"
                  >
                    <input
                      type="radio"
                      name="addressId"
                      className="mt-1 h-4 w-4 accent-bordeaux"
                      checked={selectedAddressId === address.id}
                      onChange={() => selectAddress(address.id)}
                    />
                    <span className="text-sm">
                      <span className="font-medium">{address.fullName}</span> — {address.province}،{" "}
                      {address.city}، {address.addressLine}
                      <span dir="ltr" className="block text-ink-muted">
                        {address.phone}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}

            {problem?.fieldErrors.addressId && (
              <p role="alert" className="text-sm text-danger">
                {problem.fieldErrors.addressId}
              </p>
            )}

            {showAddForm ? (
              <AddressForm onSaved={handleAddressCreated} onCancel={() => setShowAddForm(false)} />
            ) : (
              <Button type="button" variant="secondary" onClick={() => setShowAddForm(true)}>
                افزودن آدرس جدید
              </Button>
            )}
          </Card>

          <Card padding="lg" className="flex flex-col gap-4">
            <h2 className="type-h3">مرور سفارش</h2>
            <ul className="flex flex-col gap-3">
              {cart.items.map((item) => {
                const info = unavailableInfo[item.variantId];
                const broken = !item.isAvailable || info !== undefined;
                return (
                  <li
                    key={item.variantId}
                    className="flex items-start gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-ivory-soft">
                      {item.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element -- تصاویر از دامنه‌های متنوع فروشندگان می‌آیند
                        <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 text-sm">
                      <p className="font-medium">{item.productTitle}</p>
                      <p className="type-caption">
                        {item.size} / {item.color} × {formatNumber(item.quantity)}
                      </p>
                      {broken && (
                        <p className="mt-1 text-danger">
                          <Badge variant="danger">ناموجود</Badge>{" "}
                          {item.availableStock > 0
                            ? `فقط ${formatNumber(item.availableStock)} عدد موجود است`
                            : "این کالا دیگر در دسترس نیست"}
                        </p>
                      )}
                    </div>
                    <span className="type-price">{formatPrice(item.lineTotal)}</span>
                  </li>
                );
              })}
            </ul>
            <Link href="/cart" className="text-sm text-bordeaux underline">
              ویرایش سبد خرید
            </Link>
          </Card>
        </div>

        <Card padding="lg" className="flex h-fit flex-col gap-4">
          <h2 className="type-h3">خلاصه سفارش</h2>
          <div className="flex items-center justify-between text-sm text-ink-muted">
            <span>جمع کالاها ({formatNumber(cart.itemCount)} عدد)</span>
            <span>{formatPrice(cart.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-ink-muted">
            <span>هزینه ارسال</span>
            <span>محاسبه نشده</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="type-label">مبلغ سفارش</span>
            <span className="type-price">{formatPrice(cart.subtotal)}</span>
          </div>
          <p className="type-caption">
            پس از ثبت، سفارش در وضعیت «در انتظار پرداخت» قرار می‌گیرد و تا تأیید پرداخت قطعی
            نیست؛ تا آن زمان می‌توانید آن را لغو کنید.
          </p>

          {priceNotice && (
            <p role="alert" className="rounded border border-warning bg-warning-tint p-3 text-sm">
              قیمت‌ها تغییر کرده است: مبلغ از {formatPrice(priceNotice.previous)} به{" "}
              {formatPrice(priceNotice.current)} رسید. اگر موافقید، مبلغ جدید را تأیید کنید.
            </p>
          )}

          {problem && problem.kind !== "price_changed" && (
            <div role="alert" className="rounded border border-danger bg-danger-tint p-3 text-sm text-danger">
              <p>{problem.message}</p>
              {problem.kind === "auth" && (
                <Link href="/login?next=/checkout" className="mt-2 inline-block underline">
                  ورود به حساب کاربری
                </Link>
              )}
              {problem.kind === "unavailable" && (
                <p className="mt-1">لطفاً سبد خرید را اصلاح کنید.</p>
              )}
              {problem.kind === "retryable" && (
                <p className="mt-1">
                  اگر مطمئن نیستید سفارش ثبت شده یا نه، دوباره دکمه را بزنید؛ سفارش تکراری ساخته نمی‌شود.
                </p>
              )}
            </div>
          )}

          {hasUnavailable && !problem && (
            <p className="text-sm text-danger">
              برخی کالاهای سبد موجودی کافی ندارند. لطفاً از صفحه سبد خرید اصلاح کنید.
            </p>
          )}

          <Button
            type="button"
            fullWidth
            size="lg"
            loading={submitting}
            disabled={!selectedAddressId || hasUnavailable || submitting}
            onClick={handleSubmit}
          >
            {priceNotice ? "تأیید مبلغ جدید و ثبت سفارش" : "تأیید و ثبت سفارش"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
