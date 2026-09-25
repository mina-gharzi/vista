import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError, ConflictError, NotFoundError } from "../../src/errors/AppError";
import { errorHandler } from "../../src/middlewares/errorHandler";
import { validate } from "../../src/middlewares/validate";

vi.mock("../../src/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function buildApp(setup: (app: express.Express) => void): express.Express {
  const app = express();
  app.use(express.json({ limit: "1kb" }));
  setup(app);
  app.use(errorHandler);
  return app;
}

describe("errorHandler", () => {
  it("AppError را به پاسخ استاندارد با status و code درست تبدیل می‌کند", async () => {
    const app = buildApp((a) => {
      a.get("/conflict", () => {
        throw new ConflictError("تکراری است");
      });
    });

    const res = await request(app).get("/conflict");

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      error: { code: "CONFLICT_ERROR", message: "تکراری است" },
    });
  });

  it("خطای Validation را با details هر فیلد برمی‌گرداند (ZodError)", async () => {
    const schema = z.object({ email: z.string().email("ایمیل معتبر نیست") });
    const app = buildApp((a) => {
      a.post("/register", validate(schema, "body"), (_req, res) => {
        res.json({ success: true });
      });
    });

    const res = await request(app).post("/register").send({ email: "bad" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual({ email: ["ایمیل معتبر نیست"] });
  });

  it("خطای ناشناخته را 500 برمی‌گرداند و جزئیات داخلی را فاش نمی‌کند", async () => {
    const app = buildApp((a) => {
      a.get("/boom", () => {
        throw new Error("password=secret at db.ts:42");
      });
    });

    const res = await request(app).get("/boom");

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(JSON.stringify(res.body)).not.toContain("secret");
  });

  // Regression: قبلاً JSON خراب یا Body بزرگ به‌اشتباه 500 برمی‌گرداند
  it("JSON نامعتبر را 400 برمی‌گرداند نه 500", async () => {
    const app = buildApp((a) => {
      a.post("/echo", (_req, res) => {
        res.json({ success: true });
      });
    });

    const res = await request(app)
      .post("/echo")
      .set("Content-Type", "application/json")
      .send("{bad");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("Body بزرگ‌تر از حد مجاز را 413 برمی‌گرداند", async () => {
    const app = buildApp((a) => {
      a.post("/echo", (_req, res) => {
        res.json({ success: true });
      });
    });

    const res = await request(app)
      .post("/echo")
      .send({ data: "x".repeat(5000) });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });
});

describe("errorHandler — ZodError از کپی دیگری از zod", () => {
  // Regression: وقتی shared و backend دو کپی متفاوت از zod دارند، instanceof شکست می‌خورد و 500 برمی‌گشت
  it("خطای شبیه ZodError که instance این zod نیست هم 400 می‌شود", async () => {
    class ForeignZodError extends Error {
      override name = "ZodError";
      issues = [{ path: ["password"], message: "رمز ضعیف است" }];
    }
    const app = buildApp((a) => {
      a.get("/foreign", () => {
        throw new ForeignZodError("invalid");
      });
    });

    const res = await request(app).get("/foreign");

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual({ password: ["رمز ضعیف است"] });
  });
});

describe("AppError", () => {
  it("همه خطاهای دامنه از یک AppError مرکزی ارث می‌برند", () => {
    expect(new NotFoundError()).toBeInstanceOf(AppError);
    expect(new NotFoundError().statusCode).toBe(404);
  });
});
