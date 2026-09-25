"use client";

import { useState, type ReactNode } from "react";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dropdown,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Pagination,
  RadioGroup,
  Select,
  Skeleton,
  SkeletonText,
  Spinner,
  Tabs,
  Textarea,
  useToast,
} from "@/components/ui";
import { formatPrice } from "@/lib/utils/format";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-8">
      <h2 className="type-h2">{title}</h2>
      {children}
    </section>
  );
}

export function Showcase() {
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(3);
  const [shipping, setShipping] = useState("standard");
  const { toast } = useToast();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="type-h1">Design System — ویستا</h1>
        <p className="text-ink-muted">مرور Componentهای پایه. این صفحه در Production وجود ندارد.</p>
      </header>

      <Section title="Typography">
        <p className="type-h1">عنوان H1</p>
        <p className="type-h2">عنوان H2</p>
        <p className="type-h3">عنوان H3</p>
        <p className="type-body">متن اصلی Body برای توضیحات محصول.</p>
        <p className="type-label">برچسب Label</p>
        <p className="type-caption">متن کوچک Caption</p>
        <p className="type-price">{formatPrice(1250000)}</p>
      </Section>

      <Section title="Button">
        <div className="flex flex-wrap items-center gap-3">
          <Button>افزودن به سبد</Button>
          <Button variant="secondary">مشاهده</Button>
          <Button variant="ghost">انصراف</Button>
          <Button variant="danger">حذف</Button>
          <Button loading>در حال ارسال</Button>
          <Button disabled>غیرفعال</Button>
          <Button size="sm">کوچک</Button>
          <Button size="lg">بزرگ</Button>
        </div>
      </Section>

      <Section title="Form">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="ایمیل" type="email" dir="ltr" placeholder="name@example.com" required />
          <Input label="رمز عبور" type="password" dir="ltr" hint="حداقل ۸ کاراکتر" />
          <Input label="کد پستی" error="کد پستی معتبر نیست" defaultValue="123" />
          <Select label="استان" defaultValue="">
            <option value="" disabled>
              انتخاب کنید
            </option>
            <option value="tehran">تهران</option>
            <option value="isfahan">اصفهان</option>
          </Select>
          <div className="sm:col-span-2">
            <Textarea label="توضیحات سفارش" hint="اختیاری" />
          </div>
          <Checkbox label="قوانین و مقررات را می‌پذیرم" />
          <RadioGroup
            legend="روش ارسال"
            name="shipping"
            value={shipping}
            onValueChange={setShipping}
            options={[
              { value: "standard", label: "عادی" },
              { value: "express", label: "سریع" },
            ]}
          />
        </div>
      </Section>

      <Section title="Card, Badge">
        <Card className="flex flex-col items-start gap-3">
          <div className="flex gap-2">
            <Badge>جدید</Badge>
            <Badge variant="brand">پرفروش</Badge>
            <Badge variant="premium">۲۰٪ تخفیف</Badge>
            <Badge variant="success">موجود</Badge>
            <Badge variant="warning">تنها ۲ عدد</Badge>
            <Badge variant="danger">ناموجود</Badge>
          </div>
          <p className="type-label">پیراهن کتان</p>
          <p className="type-price">{formatPrice(890000)}</p>
        </Card>
      </Section>

      <Section title="Tabs, Dropdown, Modal, Toast">
        <Tabs
          label="اطلاعات محصول"
          tabs={[
            {
              value: "desc",
              label: "توضیحات",
              content: <p>توضیحات محصول اینجا نمایش داده می‌شود.</p>,
            },
            { value: "size", label: "راهنمای سایز", content: <p>جدول سایز.</p> },
            { value: "reviews", label: "نظرات", content: <p>نظرات کاربران.</p> },
          ]}
        />
        <div className="flex flex-wrap gap-3">
          <Dropdown
            label="حساب کاربری"
            items={[
              {
                key: "orders",
                label: "سفارش‌های من",
                onSelect: () => toast({ title: "سفارش‌ها" }),
              },
              { key: "wishlist", label: "علاقه‌مندی‌ها", disabled: true },
              {
                key: "logout",
                label: "خروج",
                tone: "danger",
                onSelect: () => toast({ title: "خارج شدید" }),
              },
            ]}
          />
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            باز کردن Modal
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast({ title: "به سبد اضافه شد", variant: "success" })}
          >
            Toast موفق
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast({ title: "خطا", description: "موجودی کافی نیست", variant: "error" })
            }
          >
            Toast خطا
          </Button>
        </div>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="حذف از سبد خرید"
          description="این محصول از سبد خرید شما حذف می‌شود."
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                انصراف
              </Button>
              <Button variant="danger" onClick={() => setModalOpen(false)}>
                حذف
              </Button>
            </>
          }
        />
      </Section>

      <Section title="Pagination">
        <Pagination page={page} totalPages={12} onPageChange={setPage} />
      </Section>

      <Section title="Loading / Empty / Error">
        <div className="grid gap-6 sm:grid-cols-2">
          <div aria-busy="true" className="flex flex-col gap-3">
            <Skeleton className="aspect-[3/4] w-full" />
            <SkeletonText lines={2} />
            <Spinner />
          </div>
          <Card padding="none">
            <EmptyState
              title="سبد خرید شما خالی است"
              description="محصولی به سبد اضافه نشده."
              action={<Button>مشاهده محصولات</Button>}
            />
          </Card>
          <Card padding="none" className="sm:col-span-2">
            <ErrorState onRetry={() => toast({ title: "تلاش مجدد" })} />
          </Card>
        </div>
      </Section>
    </main>
  );
}
