import express, { type Express } from "express";
import { errorHandler } from "../../src/middlewares/errorHandler";
import { createReviewsController } from "../../src/modules/reviews/reviews.controller";
import {
  createProductReviewsRouter,
  createReviewsRouter,
} from "../../src/modules/reviews/reviews.routes";
import { createReviewsService } from "../../src/modules/reviews/reviews.service";
import { FakeReviewsRepository } from "./fakeReviewsRepository";

export function buildReviewsApp(): { app: Express; repo: FakeReviewsRepository } {
  const repo = new FakeReviewsRepository();
  const service = createReviewsService(repo);
  const controller = createReviewsController(service);

  const app = express();
  app.use(express.json());
  // دقیقاً مثل app.ts واقعی: هر دو Router زیر یک مسیر پایه مشترک (/api/products) نصب می‌شوند
  // تا تداخل احتمالی مسیرها (catalog در همین پروژه) همین‌جا هم تست شود.
  app.use("/api/products/:productId/reviews", createProductReviewsRouter(controller));
  app.use("/api/reviews", createReviewsRouter(controller));
  app.use(errorHandler);

  return { app, repo };
}
