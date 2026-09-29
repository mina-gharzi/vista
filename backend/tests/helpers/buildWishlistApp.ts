import express, { type Express } from "express";
import { errorHandler } from "../../src/middlewares/errorHandler";
import { createWishlistController } from "../../src/modules/wishlist/wishlist.controller";
import { createWishlistRouter } from "../../src/modules/wishlist/wishlist.routes";
import { createWishlistService } from "../../src/modules/wishlist/wishlist.service";
import { FakeWishlistRepository } from "./fakeWishlistRepository";

export function buildWishlistApp(): { app: Express; repo: FakeWishlistRepository } {
  const repo = new FakeWishlistRepository();
  const service = createWishlistService(repo);

  const app = express();
  app.use(express.json());
  app.use("/api/wishlist", createWishlistRouter(createWishlistController(service)));
  app.use(errorHandler);

  return { app, repo };
}
