"use client";

import type { AddressSummary } from "@vista/shared";
import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Modal,
  Skeleton,
  useToast,
} from "@/components/ui";
import { AddressForm } from "@/features/checkout/AddressForm";
import { addressesApi } from "@/lib/api/addresses";
import { ApiRequestError } from "@/lib/api/client";

type LoadState = "loading" | "error" | "ready";

export function AddressesManager() {
  const { toast } = useToast();
  const [state, setState] = useState<LoadState>("loading");
  const [addresses, setAddresses] = useState<AddressSummary[]>([]);
  const [editing, setEditing] = useState<AddressSummary | "new" | null>(null);
  const [deleting, setDeleting] = useState<AddressSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setState("loading");
    addressesApi
      .list()
      .then((list) => {
        setAddresses(list);
        setState("ready");
      })
      .catch(() => setState("error"));
  };

  useEffect(load, []);

  const reload = () =>
    addressesApi
      .list()
      .then(setAddresses)
      .catch(() => setState("error"));

  const handleSaved = () => {
    setEditing(null);
    void reload();
    toast({ title: "آدرس ذخیره شد", variant: "success" });
  };

  const makeDefault = async (address: AddressSummary) => {
    setBusy(true);
    try {
      await addressesApi.update(address.id, { isDefault: true });
      await reload();
    } catch (error) {
      toast({
        title: "تغییر آدرس پیش‌فرض ناموفق بود",
        description: error instanceof ApiRequestError ? error.message : undefined,
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await addressesApi.remove(deleting.id);
      setDeleting(null);
      await reload();
      toast({ title: "آدرس حذف شد", variant: "success" });
    } catch (error) {
      toast({
        title: "حذف آدرس ناموفق بود",
        description: error instanceof ApiRequestError ? error.message : undefined,
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (state === "error") {
    return <ErrorState onRetry={load} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {editing !== null ? (
        <AddressForm
          {...(editing === "new" ? {} : { initial: editing })}
          onSaved={handleSaved}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <div>
          <Button variant="secondary" onClick={() => setEditing("new")}>
            افزودن آدرس جدید
          </Button>
        </div>
      )}

      {addresses.length === 0 && editing === null ? (
        <EmptyState title="هنوز آدرسی ثبت نکرده‌اید" />
      ) : (
        addresses.map((address) => (
          <Card key={address.id} padding="lg" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="type-label">{address.fullName}</p>
              {address.isDefault && <Badge variant="brand">پیش‌فرض</Badge>}
            </div>
            <p className="text-sm text-ink-muted">
              {address.province}، {address.city}، {address.addressLine}
            </p>
            <p dir="ltr" className="text-start text-sm text-ink-muted">
              {address.phone} · {address.postalCode}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setEditing(address)}
                disabled={busy}
              >
                ویرایش
              </Button>
              {!address.isDefault && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void makeDefault(address)}
                  disabled={busy}
                >
                  انتخاب به‌عنوان پیش‌فرض
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDeleting(address)}
                disabled={busy}
              >
                حذف
              </Button>
            </div>
          </Card>
        ))
      )}

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="حذف آدرس"
        description="این آدرس حذف می‌شود. سفارش‌های قبلی شما تحت تأثیر قرار نمی‌گیرند."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              انصراف
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void confirmDelete()}>
              حذف
            </Button>
          </>
        }
      />
    </div>
  );
}
