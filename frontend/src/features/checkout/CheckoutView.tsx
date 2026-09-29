"use client";

import type { AddressSummary, CartSummary } from "@vista/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, ErrorState, Skeleton } from "@/components/ui";
import { addressesApi } from "@/lib/api/addresses";
import { cartApi } from "@/lib/api/cart";
import { ApiRequestError } from "@/lib/api/client";
import { ordersApi } from "@/lib/api/orders";
import { formatPrice } from "@/lib/utils/format";
import { AddressForm } from "./AddressForm";

type LoadState = "loading" | "error" | "ready";

export function CheckoutView() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>("loading");
  const [cart, setCart] = useState<CartSummary | null>(null);
  const [addresses, setAddresses] = useState<AddressSummary[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([cartApi.get(), addressesApi.list()])
      .then(([cartData, addressList]) => {
        setCart(cartData);
        setAddresses(addressList);
        setSelectedAddressId(
          addressList.find((a) => a.isDefault)?.id ?? addressList[0]?.id ?? null,
        );
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  const handleAddressCreated = (created: { id: string }) => {
    addressesApi.list().then((list) => {
      setAddresses(list);
      setSelectedAddressId(created.id);
      setShowAddForm(false);
    });
  };

  const handleSubmit = async () => {
    if (!selectedAddressId || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const order = await ordersApi.checkout({ addressId: selectedAddressId });
      router.replace(`/orders/${order.id}`);
    } catch (error) {
      setSubmitError(
        error instanceof ApiRequestError ? error.message : "ثبت سفارش با خطا مواجه شد",
      );
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
      <ErrorState title="سبد خرید شما خالی است" description="ابتدا محصولی به سبد اضافه کنید." />
    );
  }

  const hasUnavailable = cart.items.some((item) => !item.isAvailable);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-6">
        <Card padding="lg" className="flex flex-col gap-4">
          <h2 className="type-h3">آدرس تحویل</h2>

          {addresses.length === 0 && !showAddForm && (
            <p className="text-sm text-ink-muted">هنوز آدرسی ثبت نکرده‌اید.</p>
          )}

          {addresses.length > 0 && (
            <div className="flex flex-col gap-2">
              {addresses.map((address) => (
                <label
                  key={address.id}
                  className="flex cursor-pointer items-start gap-3 rounded border border-border p-3 has-[:checked]:border-bordeaux"
                >
                  <input
                    type="radio"
                    name="addressId"
                    className="mt-1 h-4 w-4 accent-bordeaux"
                    checked={selectedAddressId === address.id}
                    onChange={() => setSelectedAddressId(address.id)}
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
            </div>
          )}

          {showAddForm ? (
            <AddressForm onSaved={handleAddressCreated} onCancel={() => setShowAddForm(false)} />
          ) : (
            <Button type="button" variant="secondary" onClick={() => setShowAddForm(true)}>
              افزودن آدرس جدید
            </Button>
          )}
        </Card>
      </div>

      <Card padding="lg" className="flex h-fit flex-col gap-4">
        <h2 className="type-h3">خلاصه سفارش</h2>
        <div className="flex items-center justify-between text-sm text-ink-muted">
          <span>{cart.itemCount} کالا</span>
          <span>{formatPrice(cart.subtotal)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="type-label">مبلغ قابل پرداخت</span>
          <span className="type-price">{formatPrice(cart.subtotal)}</span>
        </div>
        {hasUnavailable && (
          <p className="text-sm text-danger">
            برخی کالاهای سبد موجودی کافی ندارند. لطفاً از صفحه سبد خرید اصلاح کنید.
          </p>
        )}
        {submitError && <p className="text-sm text-danger">{submitError}</p>}
        <Button
          type="button"
          fullWidth
          size="lg"
          loading={submitting}
          disabled={!selectedAddressId || hasUnavailable}
          onClick={handleSubmit}
        >
          ثبت و پرداخت سفارش
        </Button>
      </Card>
    </div>
  );
}
