import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { buildCategoriesApp } from "../helpers/buildCategoriesApp";

vi.mock("../../src/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("GET /api/categories", () => {
  it("درخت تودرتو را فقط از دسته‌های فعال می‌سازد", async () => {
    const { app, repo } = buildCategoriesApp();
    const women = repo.seed({ name: "زنانه", slug: "women" });
    repo.seed({ name: "پیراهن", slug: "women-dresses", parentId: women.id });
    repo.seed({ name: "قدیمی (غیرفعال)", slug: "old", isActive: false });

    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      slug: "women",
      children: [{ slug: "women-dresses" }],
    });
  });

  it("وقتی هیچ دسته فعالی وجود ندارد آرایه خالی برمی‌گرداند", async () => {
    const { app } = buildCategoriesApp();

    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("والد غیرفعال: فرزند به‌عنوان ریشه نمایش داده می‌شود نه اینکه مخفی شود", async () => {
    const { app, repo } = buildCategoriesApp();
    const inactiveParent = repo.seed({ name: "غیرفعال", slug: "inactive-parent", isActive: false });
    repo.seed({ name: "فرزند فعال", slug: "active-child", parentId: inactiveParent.id });

    const res = await request(app).get("/api/categories");

    expect(res.body.data).toEqual([expect.objectContaining({ slug: "active-child" })]);
  });
});

describe("GET /api/categories/:slug", () => {
  it("دسته را با Breadcrumb و فرزندان مستقیم برمی‌گرداند", async () => {
    const { app, repo } = buildCategoriesApp();
    const women = repo.seed({ name: "زنانه", slug: "women" });
    const dresses = repo.seed({ name: "پیراهن", slug: "women-dresses", parentId: women.id });
    repo.seed({ name: "پیراهن مجلسی", slug: "women-dresses-party", parentId: dresses.id });

    const res = await request(app).get("/api/categories/women-dresses");

    expect(res.status).toBe(200);
    expect(res.body.data.breadcrumb).toEqual([{ id: women.id, name: "زنانه", slug: "women" }]);
    expect(res.body.data.children).toEqual([
      expect.objectContaining({ slug: "women-dresses-party" }),
    ]);
  });

  it("دسته ریشه Breadcrumb خالی دارد", async () => {
    const { app, repo } = buildCategoriesApp();
    repo.seed({ name: "زنانه", slug: "women" });

    const res = await request(app).get("/api/categories/women");

    expect(res.body.data.breadcrumb).toEqual([]);
  });

  it("دسته ناموجود 404 می‌دهد", async () => {
    const { app } = buildCategoriesApp();

    const res = await request(app).get("/api/categories/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND_ERROR");
  });

  it("دسته غیرفعال هم 404 می‌دهد (نه فاش‌کردن وجودش)", async () => {
    const { app, repo } = buildCategoriesApp();
    repo.seed({ name: "قدیمی", slug: "old-category", isActive: false });

    const res = await request(app).get("/api/categories/old-category");

    expect(res.status).toBe(404);
  });

  it("slug نامعتبر (کاراکتر غیرمجاز) 400 می‌دهد", async () => {
    const { app } = buildCategoriesApp();

    const res = await request(app).get("/api/categories/Not_A-Valid-Slug!");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
