import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * دسته‌بندی‌های اولیه VISTA برای توسعه/دمو (طبق بخش ۵ پرامپت مادر: Mock Data موقت، تا زمانی
 * که Feature «Seller Product Management» ساخته شود و دسته‌ها از طریق Admin مدیریت شوند).
 * Idempotent است: هر بار با upsert روی slug اجرا می‌شود، پس اجرای دوباره داده تکراری نمی‌سازد.
 */
interface CategorySeed {
  name: string;
  slug: string;
  children?: CategorySeed[];
}

const categories: CategorySeed[] = [
  {
    name: "زنانه",
    slug: "women",
    children: [
      { name: "پیراهن", slug: "women-dresses" },
      { name: "بالاپوش و کت", slug: "women-outerwear" },
      { name: "بالاتنه", slug: "women-tops" },
      { name: "شلوار و دامن", slug: "women-bottoms" },
      { name: "کیف و اکسسوری", slug: "women-accessories" },
      { name: "کفش", slug: "women-shoes" },
    ],
  },
  {
    name: "مردانه",
    slug: "men",
    children: [
      { name: "پیراهن و تی‌شرت", slug: "men-shirts" },
      { name: "بالاپوش و کت", slug: "men-outerwear" },
      { name: "شلوار", slug: "men-bottoms" },
      { name: "اکسسوری", slug: "men-accessories" },
      { name: "کفش", slug: "men-shoes" },
    ],
  },
  {
    name: "بچگانه",
    slug: "kids",
    children: [
      { name: "دخترانه", slug: "kids-girls" },
      { name: "پسرانه", slug: "kids-boys" },
      { name: "نوزاد", slug: "kids-baby" },
    ],
  },
];

async function seedCategories(): Promise<void> {
  let topSortOrder = 0;

  for (const top of categories) {
    const parent = await prisma.category.upsert({
      where: { slug: top.slug },
      update: { name: top.name, sortOrder: topSortOrder },
      create: { name: top.name, slug: top.slug, sortOrder: topSortOrder },
    });
    topSortOrder += 1;

    let childSortOrder = 0;
    for (const child of top.children ?? []) {
      await prisma.category.upsert({
        where: { slug: child.slug },
        update: { name: child.name, parentId: parent.id, sortOrder: childSortOrder },
        create: {
          name: child.name,
          slug: child.slug,
          parentId: parent.id,
          sortOrder: childSortOrder,
        },
      });
      childSortOrder += 1;
    }
  }
}

async function main(): Promise<void> {
  await seedCategories();
  // eslint-disable-next-line no-console -- خروجی خلاصه اجرای Seed، مفید برای CLI
  console.log(`Seeded ${await prisma.category.count()} categories.`);
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
