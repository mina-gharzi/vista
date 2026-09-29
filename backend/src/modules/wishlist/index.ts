import { prisma } from "../../db/prisma";
import { createWishlistController } from "./wishlist.controller";
import { createWishlistRepository } from "./wishlist.repository";
import { createWishlistRouter } from "./wishlist.routes";
import { createWishlistService } from "./wishlist.service";

const repository = createWishlistRepository(prisma);
const service = createWishlistService(repository);
const controller = createWishlistController(service);

export const wishlistRouter = createWishlistRouter(controller);
