"use client";

import { productImageInputSchema } from "@vista/shared";
import { useState } from "react";
import { Button, Input } from "@/components/ui";

export interface ImageDraft {
  url: string;
  altText: string;
}

export const MAX_IMAGES = 8;

interface ProductImagesEditorProps {
  images: ImageDraft[];
  onChange: (images: ImageDraft[]) => void;
  error?: string | undefined;
}

/**
 * مدیریت تصاویر با مدل موجود ProductImage (آدرس + متن جایگزین + position).
 * هنوز زیرساخت آپلود فایل/Storage در پروژه نیست؛ بنابراین فقط «آدرس تصویر» (http/https) پذیرفته می‌شود
 * و ترتیب لیست همان position است (اولین = تصویر اصلی). با اضافه‌شدن Storage فقط منبع url عوض می‌شود.
 */
export function ProductImagesEditor({ images, onChange, error }: ProductImagesEditorProps) {
  const [url, setUrl] = useState("");
  const [altText, setAltText] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const add = () => {
    if (images.length >= MAX_IMAGES) {
      setAddError(`حداکثر ${MAX_IMAGES} تصویر مجاز است`);
      return;
    }
    const parsed = productImageInputSchema.safeParse({
      url,
      ...(altText.trim() ? { altText } : {}),
    });
    if (!parsed.success) {
      setAddError(parsed.error.issues[0]?.message ?? "آدرس تصویر معتبر نیست");
      return;
    }
    setAddError(null);
    onChange([...images, { url: parsed.data.url, altText: parsed.data.altText ?? "" }]);
    setUrl("");
    setAltText("");
  };

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    const [item] = next.splice(index, 1);
    if (item) next.splice(target, 0, item);
    onChange(next);
  };

  const remove = (index: number) => onChange(images.filter((_, i) => i !== index));

  return (
    <div className="flex flex-col gap-4">
      {images.length > 0 && (
        <ul aria-label="تصاویر محصول" className="grid gap-3 sm:grid-cols-2">
          {images.map((image, index) => (
            <li
              key={`${image.url}-${index}`}
              className="flex items-center gap-3 rounded border border-border bg-ivory p-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt={image.altText || `تصویر ${index + 1}`}
                className="h-16 w-16 shrink-0 rounded object-cover"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-xs text-ink-muted" dir="ltr">
                  {image.url}
                </span>
                {index === 0 && <span className="text-xs font-medium text-bordeaux">تصویر اصلی</span>}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`انتقال تصویر ${index + 1} به بالا`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`انتقال تصویر ${index + 1} به پایین`}
                  disabled={index === images.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`حذف تصویر ${index + 1}`}
                  onClick={() => remove(index)}
                >
                  ✕
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <Input
          label="آدرس تصویر"
          name="imageUrl"
          dir="ltr"
          placeholder="https://..."
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          error={addError ?? error ?? ""}
        />
        <Input
          label="متن جایگزین (اختیاری)"
          name="imageAlt"
          value={altText}
          maxLength={200}
          onChange={(event) => setAltText(event.target.value)}
        />
        <Button variant="secondary" onClick={add}>
          افزودن تصویر
        </Button>
      </div>
      <p className="type-caption">
        حداکثر {MAX_IMAGES} تصویر؛ اولین تصویر به‌عنوان تصویر اصلی نمایش داده می‌شود. آپلود فایل در نسخه
        بعد اضافه می‌شود.
      </p>
    </div>
  );
}
