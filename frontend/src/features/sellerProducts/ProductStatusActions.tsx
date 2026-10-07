"use client";

import type { SellerProduct } from "@vista/shared";
import { useRef, useState } from "react";
import { Button, Modal, useToast } from "@/components/ui";
import { sellerProductsApi } from "@/lib/api/sellerProducts";
import { describeProductError } from "./productErrors";
import { actionsFor } from "./productStatus";

interface ProductStatusActionsProps {
  product: SellerProduct;
  /** پس از موفقیت، محصول به‌روز شده را برمی‌گرداند */
  onChanged: (product: SellerProduct) => void;
  size?: "sm" | "md";
}

/** انتشار / لغو انتشار / آرشیو با تأیید؛ فقط اقدام‌های مجاز وضعیت فعلی نمایش داده می‌شود. */
export function ProductStatusActions({ product, onChanged, size = "sm" }: ProductStatusActionsProps) {
  const { toast } = useToast();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState<"publish" | "unpublish" | "archive" | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const actions = actionsFor(product.status);

  const run = async (kind: "publish" | "unpublish" | "archive") => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(kind);
    try {
      const updated =
        kind === "archive"
          ? await sellerProductsApi.archive(product.id)
          : await sellerProductsApi.setStatus(product.id, kind === "publish" ? "PUBLISHED" : "DRAFT");
      toast({
        title:
          kind === "publish"
            ? "محصول منتشر شد"
            : kind === "unpublish"
              ? "انتشار محصول لغو شد"
              : "محصول آرشیو شد",
        variant: "success",
      });
      setConfirmArchive(false);
      onChanged(updated);
    } catch (error) {
      const described = describeProductError(error);
      toast({
        title: described.message,
        ...(described.reasons.length > 0 ? { description: described.reasons.join("، ") } : {}),
        variant: "error",
        duration: 8000,
      });
      setConfirmArchive(false);
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  if (!actions.publish && !actions.unpublish && !actions.archive) return null;

  return (
    <>
      {actions.publish && (
        <Button size={size} loading={busy === "publish"} disabled={busy !== null} onClick={() => run("publish")}>
          انتشار
        </Button>
      )}
      {actions.unpublish && (
        <Button
          size={size}
          variant="secondary"
          loading={busy === "unpublish"}
          disabled={busy !== null}
          onClick={() => run("unpublish")}
        >
          لغو انتشار
        </Button>
      )}
      {actions.archive && (
        <Button
          size={size}
          variant="ghost"
          disabled={busy !== null}
          onClick={() => setConfirmArchive(true)}
        >
          آرشیو
        </Button>
      )}
      <Modal
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        title="آرشیو محصول"
        description={`«${product.title}» آرشیو می‌شود و دیگر قابل ویرایش یا انتشار نخواهد بود.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmArchive(false)}>
              انصراف
            </Button>
            <Button variant="danger" loading={busy === "archive"} onClick={() => run("archive")}>
              تأیید آرشیو
            </Button>
          </>
        }
      />
    </>
  );
}
