import express, { type Express } from "express";
import { errorHandler } from "../../src/middlewares/errorHandler";
import { createCategoriesController } from "../../src/modules/categories/categories.controller";
import { createCategoriesRouter } from "../../src/modules/categories/categories.routes";
import { createCategoriesService } from "../../src/modules/categories/categories.service";
import { FakeCategoriesRepository } from "./fakeCategoriesRepository";

export function buildCategoriesApp(): { app: Express; repo: FakeCategoriesRepository } {
  const repo = new FakeCategoriesRepository();
  const service = createCategoriesService(repo);

  const app = express();
  app.use("/api/categories", createCategoriesRouter(createCategoriesController(service)));
  app.use(errorHandler);

  return { app, repo };
}
