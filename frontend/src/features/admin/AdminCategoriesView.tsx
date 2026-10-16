"use client";

import { createCategorySchema, updateCategorySchema, type AdminCategory, type CreateCategoryInput, type UpdateCategoryInput } from "@vista/shared";
import { useRef, useState, type FormEvent } from "react";
import { Badge, Button, Card, Checkbox, EmptyState, Input, Modal, Select, useToast } from "@/components/ui";
import { adminApi } from "@/lib/api/admin";
import { toLatinDigits } from "@/lib/utils/digits";
import { formatNumber } from "@/lib/utils/format";
import { firstFieldErrors } from "@/lib/utils/zod";
import { QueryBoundary } from "./AdminParts";
import { ConfirmDialog } from "./ConfirmDialog";
import { describeAdminError } from "./adminErrors";
import { useAdminQuery } from "./useAdminQuery";

type Sort = "order" | "name" | "products";

interface FormState {
  name: string;
  slug: string;
  parentId: string;
  sortOrder: string;
  imageUrl: string;
  isActive: boolean;
}

function toForm(c: AdminCategory | null): FormState {
  return {
    name: c?.name ?? "",
    slug: c?.slug ?? "",
    parentId: c?.parentId ?? "",
    sortOrder: String(c?.sortOrder ?? 0),
    imageUrl: c?.imageUrl ?? "",
    isActive: c?.isActive ?? true,
  };
}

function CategoryFormDialog({
  category,
  all,
  onClose,
  onSaved,
}: {
  category: AdminCategory | null;
  all: AdminCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(toForm(category));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    setFormError(null);
    const full = {
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase(),
      parentId: form.parentId === "" ? null : form.parentId,
      sortOrder: Number(toLatinDigits(form.sortOrder) || "0"),
      imageUrl: form.imageUrl.trim() === "" ? null : form.imageUrl.trim(),
      isActive: form.isActive,
    };
    let payload: CreateCategoryInput | UpdateCategoryInput;
    if (category) {
      // فقط فیلدهای تغییر‌کرده ارسال می‌شود
      const changed: Record<string, unknown> = {};
      (Object.keys(full) as (keyof typeof full)[]).forEach((k) => {
        const before = k === "sortOrder" ? category.sortOrder : (category as unknown as Record<string, unknown>)[k];
        if (full[k] !== before) changed[k] = full[k];
      });
      if (Object.keys(changed).length === 0) {
        onClose();
        return;
      }
      const parsed = updateCategorySchema.safeParse(changed);
      if (!parsed.success) return void setErrors(firstFieldErrors(parsed.error));
      payload = parsed.data;
    } else {
      const parsed = createCategorySchema.safeParse(full);
      if (!parsed.success) return void setErrors(firstFieldErrors(parsed.error));
      payload = parsed.data;
    }
    setErrors({});

    inFlight.current = true;
    setPending(true);
    try {
      if (category) await adminApi.updateCategory(category.id, payload as UpdateCategoryInput);
      else await adminApi.createCategory(payload as CreateCategoryInput);
      toast({ title: category ? "دسته‌بندی ذخیره شد" : "دسته‌بندی ساخته شد", variant: "success" });
      onSaved();
      onClose();
    } catch (e) {
      const described = describeAdminError(e);
      setErrors(described.fieldErrors);
      setFormError(described.message);
      if (described.stale && !described.fieldErrors.slug) onSaved();
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  const formId = "category-form";
  return (
    <Modal
      open
      onClose={() => {
        if (!inFlight.current) onClose();
      }}
      title={category ? "ویرایش دسته‌بندی" : "دسته‌بندی جدید"}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            انصراف
          </Button>
          <Button type="submit" form={formId} loading={pending} disabled={pending}>
            ذخیره
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
        {formError && (
          <p role="alert" className="rounded border border-danger bg-danger-tint p-3 text-sm text-danger">
            {formError}
          </p>
        )}
        <Input label="نام" name="name" required value={form.name} onChange={(e) => set("name", e.target.value)} error={errors.name ?? ""} />
        <Input
          label="شناسه (slug)"
          name="slug"
          dir="ltr"
          required
          value={form.slug}
          onChange={(e) => set("slug", e.target.value)}
          error={errors.slug ?? ""}
          hint="فقط حروف انگلیسی کوچک، عدد و خط تیره؛ باید یکتا باشد."
        />
        <Select label="دستهٔ والد" name="parentId" value={form.parentId} onChange={(e) => set("parentId", e.target.value)} error={errors.parentId ?? ""}>
          <option value="">بدون والد (دستهٔ اصلی)</option>
          {all
            .filter((c) => c.id !== category?.id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </Select>
        <Input label="ترتیب نمایش" name="sortOrder" inputMode="numeric" value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} error={errors.sortOrder ?? ""} />
        <Input label="آدرس تصویر (اختیاری)" name="imageUrl" dir="ltr" value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} error={errors.imageUrl ?? ""} />
        <Checkbox label="فعال" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} />
      </form>
    </Modal>
  );
}

type Dialog =
  | { kind: "form"; category: AdminCategory | null }
  | { kind: "delete"; category: AdminCategory }
  | { kind: "toggle"; category: AdminCategory };

export function AdminCategoriesView() {
  const [sort, setSort] = useState<Sort>("order");
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const { state, reload } = useAdminQuery(() => adminApi.categories({ sort, q: q || undefined }), `${sort}|${q}`);
  const allQuery = useAdminQuery(() => adminApi.categories({ sort: "name" }), "all-categories");
  const refresh = () => {
    reload();
    allQuery.reload();
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-h1">دسته‌بندی‌ها</h1>
        <Button onClick={() => setDialog({ kind: "form", category: null })}>دسته‌بندی جدید</Button>
      </header>

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(draft.trim());
        }}
        className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end"
      >
        <Input label="جستجوی نام یا شناسه" name="q" autoComplete="off" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <Select label="مرتب‌سازی" name="sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="order">ترتیب نمایش</option>
          <option value="name">نام</option>
          <option value="products">تعداد محصول</option>
        </Select>
        <Button type="submit" variant="secondary">
          جستجو
        </Button>
      </form>

      <QueryBoundary state={state} reload={reload} label="دسته‌بندی‌ها">
        {(items) =>
          items.length === 0 ? (
            <EmptyState title={q ? "دسته‌ای با این جستجو پیدا نشد" : "هنوز دسته‌بندی‌ای وجود ندارد"} />
          ) : (
            <ul aria-label="فهرست دسته‌بندی‌ها" className="flex flex-col gap-3">
              {items.map((c) => (
                <li key={c.id}>
                  <Card as="article" padding="sm" className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <h2 className="font-medium">{c.name}</h2>
                      <p className="text-xs text-ink-muted">
                        <span dir="ltr">{c.slug}</span>
                        {c.parentName ? ` · والد: ${c.parentName}` : ""} · {formatNumber(c.productCount)} محصول · {formatNumber(c.childCount)} زیردسته
                      </p>
                    </div>
                    <Badge variant={c.isActive ? "success" : "neutral"}>{c.isActive ? "فعال" : "غیرفعال"}</Badge>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" aria-label={`ویرایش ${c.name}`} onClick={() => setDialog({ kind: "form", category: c })}>
                        ویرایش
                      </Button>
                      <Button size="sm" variant="secondary" aria-label={`${c.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"} ${c.name}`} onClick={() => setDialog({ kind: "toggle", category: c })}>
                        {c.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
                      </Button>
                      <Button size="sm" variant="ghost" aria-label={`حذف ${c.name}`} onClick={() => setDialog({ kind: "delete", category: c })}>
                        حذف
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )
        }
      </QueryBoundary>

      {dialog?.kind === "form" && (
        <CategoryFormDialog
          category={dialog.category}
          all={allQuery.state.status === "ready" ? allQuery.state.data : []}
          onClose={() => setDialog(null)}
          onSaved={refresh}
        />
      )}
      {dialog?.kind === "toggle" && (
        <ConfirmDialog
          title={dialog.category.isActive ? "غیرفعال‌سازی دسته‌بندی" : "فعال‌سازی دسته‌بندی"}
          description={
            dialog.category.isActive
              ? `«${dialog.category.name}» غیرفعال می‌شود. اگر محصول منتشرشده یا زیردستهٔ فعال داشته باشد، سرور اجازه نمی‌دهد.`
              : `«${dialog.category.name}» دوباره فعال می‌شود.`
          }
          confirmLabel={dialog.category.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
          successMessage="وضعیت دسته‌بندی به‌روز شد"
          onConfirm={async () => {
            await adminApi.updateCategory(dialog.category.id, { isActive: !dialog.category.isActive });
            refresh();
          }}
          onStale={refresh}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "delete" && (
        <ConfirmDialog
          title="حذف دسته‌بندی"
          description={`«${dialog.category.name}» برای همیشه حذف می‌شود. فقط دستهٔ بدون محصول و بدون زیردسته قابل حذف است.`}
          confirmLabel="حذف"
          danger
          successMessage="دسته‌بندی حذف شد"
          onConfirm={async () => {
            await adminApi.deleteCategory(dialog.category.id);
            refresh();
          }}
          onStale={refresh}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
