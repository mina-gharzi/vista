import { prisma } from "../../db/prisma";
import { createCartController } from "./cart.controller";
import { createCartRepository } from "./cart.repository";
import { createCartRouter } from "./cart.routes";
import { createCartService } from "./cart.service";

// Composition Root ماژول: Prisma → Repository → Service → Controller → Router
const repository = createCartRepository(prisma);
const service = createCartService(repository);
const controller = createCartController(service);

export const cartRouter = createCartRouter(controller);
