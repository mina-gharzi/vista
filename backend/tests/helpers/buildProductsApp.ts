import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import jwt from "jsonwebtoken";
import { errorHandler } from "../../src/middlewares/errorHandler";
import { createProductsController } from "../../src/modules/products/products.controller";
import { createProductsRouter } from "../../src/modules/products/products.routes";
import { createProductsService } from "../../src/modules/products/products.service";
import { FakeProductsRepository } from "./fakeProductsRepository";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "test_access_secret_min_32_chars_long_000";

export function buildProductsApp(): { app: Express; repo: FakeProductsRepository } {
  const repo = new FakeProductsRepository();
  const service = createProductsService(repo);

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/seller/products", createProductsRouter(createProductsController(service)));
  app.use(errorHandler);

  return { app, repo };
}

/** توکن معتبر Access Token برای شبیه‌سازی هدر Authorization در تست‌ها */
export function bearerFor(
  userId: string,
  role: "CUSTOMER" | "SELLER" | "ADMIN" = "SELLER",
): string {
  const token = jwt.sign({ role }, ACCESS_SECRET, {
    subject: userId,
    issuer: "vista", // باید با ISSUER در src/utils/tokens.ts یکی باشد
    expiresIn: "15m",
  });
  return `Bearer ${token}`;
}
