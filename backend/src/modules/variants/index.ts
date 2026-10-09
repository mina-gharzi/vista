import { prisma } from "../../db/prisma";
import { createVariantsController } from "./variants.controller";
import { createVariantsRepository } from "./variants.repository";
import { createVariantsRouter } from "./variants.routes";
import { createVariantsService } from "./variants.service";

// Composition Root ماژول: Prisma → Repository → Service → Controller → Router
const repository = createVariantsRepository(prisma);
const service = createVariantsService(repository);
const controller = createVariantsController(service);

export const variantsRouter = createVariantsRouter(controller);
