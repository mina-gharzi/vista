/** یک گره از درخت دسته‌بندی. children می‌تواند خالی باشد ولی هرگز undefined نیست. */
export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  children: CategoryNode[];
}

/** پاسخ صفحه یک دسته: خودش + مسیر Breadcrumb (از ریشه تا خودش) + فرزندان مستقیم */
export interface CategoryDetail {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  breadcrumb: Array<{ id: string; name: string; slug: string }>;
  children: CategoryNode[];
}
