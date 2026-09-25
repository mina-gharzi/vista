import { prisma } from "../../db/prisma";
import { createCategoriesController } from "./categories.controller";
import { createCategoriesRepository } from "./categories.repository";
import { createCategoriesRouter } from "./categories.routes";
import { createCategoriesService } from "./categories.service";

// Composition Root ماژول: Prisma → Repository → Service → Controller → Router
const repository = createCategoriesRepository(prisma);
const service = createCategoriesService(repository);
const controller = createCategoriesController(service);

export const categoriesRouter = createCategoriesRouter(controller);
