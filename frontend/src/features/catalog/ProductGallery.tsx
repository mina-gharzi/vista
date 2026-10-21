"use client";

import type { PublicProductImage } from "@vista/shared";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";

/** گالری تصویر: انتخاب بندانگشتی با دکمهٔ واقعی (کیبورد و aria-pressed). */
export function ProductGallery({ images, title }: { images: PublicProductImage[]; title: string }) {
  const [index, setIndex] = useState(0);
  const current = images[index] ?? images[0];

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-square overflow-hidden rounded-lg bg-ivory-soft">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element -- تصاویر از دامنه‌های متنوع فروشندگان می‌آیند
          <img src={current.url} alt={current.altText ?? title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-faint">بدون تصویر</div>
        )}
      </div>
      {images.length > 1 && (
        <ul aria-label="تصاویر محصول" className="grid grid-cols-4 gap-2">
          {images.map((image, i) => (
            <li key={image.url}>
              <button
                type="button"
                aria-label={`نمایش تصویر ${i + 1}`}
                aria-pressed={i === index}
                onClick={() => setIndex(i)}
                className={cn(
                  "aspect-square w-full overflow-hidden rounded border bg-ivory-soft focus-visible:outline-2 focus-visible:outline-offset-2",
                  i === index ? "border-bordeaux" : "border-border hover:border-ink",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- تصاویر از دامنه‌های متنوع فروشندگان می‌آیند */}
                <img src={image.url} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
