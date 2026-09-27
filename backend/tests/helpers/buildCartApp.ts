import express, { type Express } from "express";
import { errorHandler } from "../../src/middlewares/errorHandler";
import { createCartController } from "../../src/modules/cart/cart.controller";
import { createCartRouter } from "../../src/modules/cart/cart.routes";
import { createCartService } from "../../src/modules/cart/cart.service";
import { FakeCartRepository } from "./fakeCartRepository";

export function buildCartApp(): { app: Express; repo: FakeCartRepository } {
  const repo = new FakeCartRepository();
  const service = createCartService(repo);

  const app = express();
  app.use(express.json());
  app.use("/api/cart", createCartRouter(createCartController(service)));
  app.use(errorHandler);

  return { app, repo };
}
