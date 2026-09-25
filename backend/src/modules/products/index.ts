import { prisma } from "../../db/prisma";
import { createProductsController } from "./products.controller";
import { createProductsRepository } from "./products.repository";
import { createProductsRouter } from "./products.routes";
import { createProductsService } from "./products.service";

// Composition Root ماژول: Prisma → Repository → Service → Controller → Router
const repository = createProductsRepository(prisma);
const service = createProductsService(repository);
const controller = createProductsController(service);

export const productsRouter = createProductsRouter(controller);
