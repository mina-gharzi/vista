import { prisma } from "../../db/prisma";
import { createSellerOrdersController } from "./sellerOrders.controller";
import { createSellerOrdersRepository } from "./sellerOrders.repository";
import { createSellerOrdersRouter } from "./sellerOrders.routes";
import { createSellerOrdersService } from "./sellerOrders.service";

// Composition Root ماژول: Prisma → Repository → Service → Controller → Router
const repository = createSellerOrdersRepository(prisma);
const service = createSellerOrdersService(repository);
const controller = createSellerOrdersController(service);

export const sellerOrdersRouter = createSellerOrdersRouter(controller);
